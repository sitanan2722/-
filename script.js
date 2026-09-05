/* ==========================================================================
   script.js — ใช้ร่วมกันทุกหน้า (product.html, order.html, admin.html)
   ตรวจว่ากำลังอยู่หน้าไหนจาก id ของ element บนหน้านั้น แล้วรันฟังก์ชันที่เกี่ยวข้อง
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) {
    initProductPage();
  }
  if (document.getElementById('orderForm')) {
    initOrderPage();
  }
  if (document.querySelector('#ordersTable tbody')) {
    initAdminPage();
  }
});

/* ==========================================================================
   1) product.html — โหลดสินค้า + กรองตาม mood
   ========================================================================== */

function initProductPage() {
  const listEl = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');

  fetch('products.json')
    .then(function (res) { return res.json(); })
    .then(function (products) {
      // อ่าน mood จาก URL parameter (?mood=xxx) ถ้ามี ให้กรองอัตโนมัติ
      const params = new URLSearchParams(window.location.search);
      const initialMood = params.get('mood') || 'ทั้งหมด';

      renderProducts(products, initialMood);
      setActiveFilterButton(filterBar, initialMood);

      if (filterBar) {
        filterBar.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-mood]');
          if (!btn) return;

          const mood = btn.getAttribute('data-mood');
          renderProducts(products, mood);
          setActiveFilterButton(filterBar, mood);

          // อัปเดต URL ให้ตรงกับ mood ที่เลือก (ไม่รีโหลดหน้า)
          const url = new URL(window.location.href);
          if (mood === 'ทั้งหมด') {
            url.searchParams.delete('mood');
          } else {
            url.searchParams.set('mood', mood);
          }
          window.history.replaceState({}, '', url);
        });
      }
    })
    .catch(function (error) {
      console.error(error);
      listEl.innerHTML = '<p class="empty-state">ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    });
}

function renderProducts(products, mood) {
  const listEl = document.getElementById('product-list');
  listEl.innerHTML = '';

  const filtered = (mood === 'ทั้งหมด')
    ? products
    : products.filter(function (p) { return p.mood === mood; });

  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="empty-state">ไม่พบสินค้าในหมวดนี้ ลองเลือกอารมณ์อื่นดูนะ</p>';
    return;
  }

  filtered.forEach(function (product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-mood', product.mood);

    const orderUrl = 'order.html?item=' + encodeURIComponent(product.name + ' ' + product.size)
      + '&price=' + encodeURIComponent(product.price);

    card.innerHTML =
      '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '">' +
      '<h3 class="product-name">' + escapeHtml(product.name) + '</h3>' +
      '<p class="product-size">' + escapeHtml(product.size) + '</p>' +
      '<p class="product-price">' + escapeHtml(String(product.price)) + ' บาท</p>' +
      '<a class="btn-order" href="' + orderUrl + '">สั่งซื้อ</a>';

    listEl.appendChild(card);
  });
}

function setActiveFilterButton(filterBar, mood) {
  if (!filterBar) return;
  const buttons = filterBar.querySelectorAll('[data-mood]');
  buttons.forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-mood') === mood);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

/* ==========================================================================
   2) order.html — เติมฟอร์มจาก URL parameter + ส่งข้อมูลไป Apps Script
   ========================================================================== */

function initOrderPage() {
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  if (item !== null && itemsInput) {
    itemsInput.value = item;
  }
  if (price !== null && totalInput) {
    totalInput.value = price;
  }

  const form = document.getElementById('orderForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    fetch('https://script.google.com/macros/s/AKfycbw7vxcGdF3LieTg-Xok7EgAvwuHK92onXjeA05Q2FMFJxEwJ5GLWZpyghPmN8dNTCGTlA/exec', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(function () {
        window.location.href = 'thankyou.html';
      })
      .catch(function (error) {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
  });
}

/* ==========================================================================
   3) admin.html — ดึง CSV จาก Google Sheets (Publish to web) มาแสดงเป็นตาราง
   ========================================================================== */

var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYzEf3xtgI6MY15GlLaxqOPV2EJ0fNaF9fY57TFI_cCdp9vDVMiRLCUWIY2RE4yQV4V0cVYLNtlz3w/pub?gid=0&single=true&output=csv';

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');

  fetch(SHEET_CSV_URL)
    .then(function (res) { return res.text(); })
    .then(function (csvText) {
      const rows = parseCSV(csvText);
      if (rows.length === 0) return;

      // แถวแรกคือ header ตัดทิ้ง
      const dataRows = rows.slice(1).filter(function (r) {
        return r.length > 1 || (r[0] && r[0].trim() !== '');
      });

      // เรียงล่าสุดขึ้นก่อน (สมมติแถวใหม่ถูกเพิ่มต่อท้ายชีตเสมอ)
      dataRows.reverse();

      tbody.innerHTML = '';
      dataRows.forEach(function (row) {
        const tr = document.createElement('tr');
        // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
        for (let i = 0; i < 6; i++) {
          const td = document.createElement('td');
          td.textContent = row[i] !== undefined ? row[i] : '';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      tbody.innerHTML = '<tr><td colspan="6">ไม่สามารถโหลดข้อมูลออเดอร์ได้</td></tr>';
    });
}

/**
 * แปลง CSV string เป็น array ของ array (แถว x คอลัมน์)
 * รองรับ field ที่ครอบด้วย double quote และมี comma / ขึ้นบรรทัดใหม่อยู่ข้างใน
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
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        // ข้าม \r เฉยๆ รอ \n ปิดแถว
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }

  // แถวสุดท้ายถ้ายังมีข้อมูลค้าง
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
