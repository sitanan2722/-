/* =========================================================
   ChaJai (ชาใจ) — Shared Script
   Used on product.html, order.html and admin.html.
   Each init function only runs if its page's key element exists,
   so one file can be included on every page.
   ========================================================= */

(() => {
  'use strict';

  const PRODUCTS_JSON_URL = 'products.json';

  const ORDER_SUBMIT_URL =
    'https://script.google.com/macros/s/AKfycbzOFo0Hw6XUfeNlgITrkdZGgDCn1UZOJzNU9g_WTnndv-uHeg_grRh3hnJSkApT13TWfg/exec';

  const ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYzEf3xtgI6MY15GlLaxqOPV2EJ0fNaF9fY57TFI_cCdp9vDVMiRLCUWIY2RE4yQV4V0cVYLNtlz3w/pub?gid=0&single=true&output=csv';

  const MOOD_LABELS = {
    all: 'ทั้งหมด',
    fresh: 'Fresh',
    relax: 'Relax',
    focus: 'Focus',
    sweet: 'Sweet',
  };

  const SIZE_LABELS = {
    '250ml': 'เล็ก',
    '500ml': 'ใหญ่',
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('product-list')) initProductPage();
    if (document.getElementById('orderForm')) initOrderPage();
    if (document.querySelector('#ordersTable tbody')) initAdminPage();
  });

  /* =========================================================
     Helpers
     ========================================================= */

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function formatPrice(price) {
    const num = Number(price);
    return Number.isFinite(num) ? num.toLocaleString('th-TH') : escapeHtml(price);
  }

  /* =========================================================
     1. product.html — product list + mood filter
     ========================================================= */

  function initProductPage() {
    const listEl = document.getElementById('product-list');
    const filterBarEl = document.getElementById('filter-bar');

    const params = new URLSearchParams(window.location.search);
    let currentMood = params.get('mood') || 'all';
    if (!MOOD_LABELS[currentMood]) currentMood = 'all';

    fetch(PRODUCTS_JSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error('โหลดข้อมูลสินค้าไม่สำเร็จ');
        return res.json();
      })
      .then((products) => {
        if (filterBarEl) {
          buildFilterBar(filterBarEl, currentMood, (mood) => {
            currentMood = mood;
            setActiveFilterButton(filterBarEl, currentMood);
            renderProductList(listEl, products, currentMood);
          });
        }
        renderProductList(listEl, products, currentMood);
      })
      .catch((error) => {
        console.error(error);
        if (listEl) {
          listEl.innerHTML = '<p class="text-muted">ไม่สามารถโหลดรายการสินค้าได้ในขณะนี้</p>';
        }
      });
  }

  // Build the filter buttons once; onSelect is called with the chosen mood.
  function buildFilterBar(filterBarEl, activeMood, onSelect) {
    filterBarEl.innerHTML = '';
    Object.keys(MOOD_LABELS).forEach((mood) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = MOOD_LABELS[mood];
      btn.dataset.mood = mood;
      btn.className = 'btn';
      btn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        if (mood === 'all') {
          url.searchParams.delete('mood');
        } else {
          url.searchParams.set('mood', mood);
        }
        window.history.replaceState({}, '', url);
        onSelect(mood);
      });
      filterBarEl.appendChild(btn);
    });
    setActiveFilterButton(filterBarEl, activeMood);
  }

  // Toggle which button looks "active" without rebuilding the bar.
  function setActiveFilterButton(filterBarEl, activeMood) {
    filterBarEl.querySelectorAll('button[data-mood]').forEach((btn) => {
      const isActive = btn.dataset.mood === activeMood;
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('btn-secondary', !isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderProductList(listEl, products, mood) {
    if (!listEl) return;

    const filtered = mood === 'all' ? products : products.filter((p) => p.mood === mood);

    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="text-muted">ไม่พบสินค้าในหมวดนี้</p>';
      return;
    }

    listEl.innerHTML = filtered.map((p) => productCardHtml(p)).join('');
  }

  function productCardHtml(p) {
    const sizeLabel = SIZE_LABELS[p.size] || '';
    const itemName = `${p.name} ${sizeLabel} ${p.size}`.replace(/\s+/g, ' ').trim();
    const orderUrl = `order.html?item=${encodeURIComponent(itemName)}&price=${encodeURIComponent(p.price)}`;

    return `
      <article class="card product-card" data-mood="${escapeHtml(p.mood)}">
        <div class="product-card__media">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(itemName)}" loading="lazy">
        </div>
        <div class="product-card__body">
          <span class="mood-tag mood-${escapeHtml(p.mood)}">${escapeHtml(MOOD_LABELS[p.mood] || p.mood)}</span>
          <h3 class="product-card__name">${escapeHtml(p.name)}</h3>
          <p class="product-card__size">${escapeHtml(sizeLabel)} ${escapeHtml(p.size)}</p>
          <p class="product-card__desc">${escapeHtml(p.description)}</p>
          <div class="product-card__footer">
            <span class="product-card__price">฿${formatPrice(p.price)}</span>
            <a class="btn btn-primary" href="${orderUrl}">สั่งซื้อ</a>
          </div>
        </div>
      </article>
    `;
  }

  /* =========================================================
     2. order.html — prefill form + submit to Apps Script
     ========================================================= */

  function initOrderPage() {
    const form = document.getElementById('orderForm');
    const itemsField = document.getElementById('items');
    const totalField = document.getElementById('total');

    const params = new URLSearchParams(window.location.search);
    const item = params.get('item');
    const price = params.get('price');

    if (itemsField && item) itemsField.value = item;
    if (totalField && price) totalField.value = price;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const payload = {
        customerName: document.getElementById('customerName')?.value.trim() || '',
        contact: document.getElementById('contact')?.value.trim() || '',
        items: document.getElementById('items')?.value.trim() || '',
        total: document.getElementById('total')?.value.trim() || '',
        note: document.getElementById('note')?.value.trim() || '',
      };

      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // Google Apps Script web apps don't return CORS headers that the
      // browser will accept, so a normal fetch() rejects here even when
      // the order was saved successfully on the Sheet side. mode: 'no-cors'
      // sends the request without trying to read/validate the response
      // (we don't need the response body anyway), so it resolves instead
      // of throwing and we can safely move on to the thank-you page.
      fetch(ORDER_SUBMIT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      })
        .then(() => {
          window.location.href = 'thankyou.html';
        })
        .catch((error) => {
          console.error(error);
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* =========================================================
     3. admin.html — fetch published CSV, parse, render table
     ========================================================= */

  function initAdminPage() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-muted">กำลังโหลดข้อมูล...</td></tr>';

    fetch(ORDERS_CSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error('โหลดข้อมูลออเดอร์ไม่สำเร็จ');
        return res.text();
      })
      .then((csvText) => {
        const rows = parseCSV(csvText).filter((row) => row.some((cell) => cell !== ''));
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-muted">ยังไม่มีออเดอร์</td></tr>';
          return;
        }

        // First row is the header: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
        const dataRows = rows.slice(1);

        const sortedRows = dataRows
          .map((row, index) => ({ row, index }))
          .sort((a, b) => {
            const dateA = Date.parse(a.row[0]);
            const dateB = Date.parse(b.row[0]);
            if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) {
              return dateB - dateA; // newest first
            }
            return b.index - a.index; // fallback: last appended first
          })
          .map((entry) => entry.row);

        tbody.innerHTML = sortedRows.map((row) => orderRowHtml(row)).join('');
      })
      .catch((error) => {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">ไม่สามารถโหลดข้อมูลออเดอร์ได้ในขณะนี้</td></tr>';
      });
  }

  function orderRowHtml(row) {
    const [datetime, customerName, contact, items, total, note] = row;
    return `
      <tr>
        <td>${escapeHtml(datetime)}</td>
        <td>${escapeHtml(customerName)}</td>
        <td>${escapeHtml(contact)}</td>
        <td>${escapeHtml(items)}</td>
        <td>฿${formatPrice(total)}</td>
        <td>${escapeHtml(note)}</td>
      </tr>
    `;
  }

  /**
   * Minimal RFC 4180-ish CSV parser (no external library).
   * Handles quoted fields, embedded commas, embedded newlines,
   * and escaped double-quotes (""), plus \r\n / \n line endings.
   * Returns an array of rows, each row an array of string cells.
   */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        // skip, handled by \n
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    // last field/row (file may not end with a newline)
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows.map((r) => r.map((cell) => cell.trim()));
  }
})();
