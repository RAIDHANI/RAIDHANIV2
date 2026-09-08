/* ============================================================
   RAIDHANI - Admin Orders & Executive Metrics (PRD v2.1 §9 FR-14, FR-15, FR-16)
   Order queue, inspection panel, CSV export, and financial calculations

   Pengelompokan multi-produk: satu checkout dari keranjang bisa
   menghasilkan >1 baris di tabel `orders` (satu per produk), yang
   ditautkan lewat kolom `order_group_id`. Modul ini mengelompokkan
   baris-baris itu jadi satu "pesanan" di seluruh tampilan admin
   (tabel, panel inspeksi, invoice, label, manifest) — supaya 1
   transaksi pelanggan tidak terlihat sebagai beberapa pesanan
   terpisah yang membingungkan saat verifikasi mutasi.
   ============================================================ */

(function(window) {
  'use strict';

  let allOrders = [];
  let allGroups = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let selectedGroupId = null;

  function formatIDR(val) {
    return 'Rp ' + (Number(val) || 0).toLocaleString('id-ID');
  }

  // Gabungkan baris-baris order yang berbagi order_group_id yang sama
  // jadi satu objek "group" — 1 group = 1 transaksi/1 kali bayar oleh
  // pelanggan, walau isinya beberapa produk berbeda.
  function groupOrders(orders) {
    const map = new Map();

    orders.forEach(o => {
      const gid = o.order_group_id || o.order_id;
      if (!map.has(gid)) {
        map.set(gid, {
          group_id: gid,
          order_ids: [],
          items: [],
          buyer_name: o.buyer_name,
          buyer_whatsapp: o.buyer_whatsapp,
          buyer_address: o.buyer_address,
          buyer_city_district: o.buyer_city_district,
          buyer_postal_code: o.buyer_postal_code,
          buyer_notes: o.buyer_notes,
          coupon_code: o.coupon_code,
          payment_method: o.payment_method,
          payment_proof_url: null,
          created_at: o.created_at,
          total_price: 0,
          statuses: []
        });
      }
      const g = map.get(gid);
      g.order_ids.push(o.order_id);
      g.items.push(o);
      g.total_price += (o.total_price || 0);
      g.statuses.push(o.status);
      if (!g.payment_proof_url && o.payment_proof_url) g.payment_proof_url = o.payment_proof_url;
      if (o.created_at && (!g.created_at || new Date(o.created_at) < new Date(g.created_at))) {
        g.created_at = o.created_at;
      }
    });

    return Array.from(map.values()).map(g => {
      // Status gabungan: konservatif — kalau ada 1 saja yang masih
      // pending/lunas, seluruh group dianggap begitu (jangan sampai
      // ada produk yang lolos verifikasi/pengiriman lebih dulu).
      let status = 'selesai';
      if (g.statuses.includes('pending')) status = 'pending';
      else if (g.statuses.includes('lunas')) status = 'lunas';
      else if (g.statuses.includes('dikirim')) status = 'dikirim';
      return { ...g, status };
    });
  }

  const RaidhaniAdminOrders = {
    async init() {
      await this.loadOrders();
      this.bindEvents();
      await this.renderMetrics();
      this.renderTable();
      this.renderPendingAlert();
      this.renderRecentActivity();
      this.renderLogistics();

      // Listen to cross-window or local updates
      window.addEventListener('raidhani:orders-updated', async (e) => {
        allOrders = e.detail;
        allGroups = groupOrders(allOrders);
        await this.renderMetrics();
        this.renderTable();
        this.renderPendingAlert();
        this.renderRecentActivity();
        this.renderLogistics();
      });
    },

    async loadOrders() {
      allOrders = await window.RaidhaniData.getOrders();
      allGroups = groupOrders(allOrders);
      if (allGroups.length > 0 && !selectedGroupId) {
        selectedGroupId = allGroups[0].group_id;
      }
    },

    bindEvents() {
      // 1. Status Filter Tabs
      document.querySelectorAll('.admin-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.admin-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentFilter = btn.dataset.status || 'all';
          this.renderTable();
        });
      });

      // 2. Search Input
      const searchInput = document.getElementById('order-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          currentSearch = e.target.value.toLowerCase().trim();
          this.renderTable();
        });
      }

      // 3. Export CSV Button
      const exportBtn = document.getElementById('btn-export-csv');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportCSV());
      }
    },

    getFilteredGroups() {
      return allGroups.filter(g => {
        const matchesFilter = currentFilter === 'all' || g.status === currentFilter;
        const matchesSearch = !currentSearch ||
          g.group_id.toLowerCase().includes(currentSearch) ||
          g.buyer_name.toLowerCase().includes(currentSearch) ||
          g.buyer_whatsapp.includes(currentSearch) ||
          g.items.some(it => (it.product_name || '').toLowerCase().includes(currentSearch));
        return matchesFilter && matchesSearch;
      });
    },

    async renderMetrics() {
      let grossOmzet = 0;
      let countLunas = 0;
      let countPending = 0;
      let countShipped = 0;
      const productCount = {};

      allGroups.forEach(g => {
        grossOmzet += g.total_price || 0;
        if (g.status === 'lunas') countLunas++;
        else if (g.status === 'pending') countPending++;
        else if (g.status === 'dikirim' || g.status === 'selesai') countShipped++;
      });

      allOrders.forEach(o => {
        if (o.product_name) {
          productCount[o.product_name] = (productCount[o.product_name] || 0) + (o.qty || 1);
        }
      });

      const totalOrders = allGroups.length;
      const aov = totalOrders > 0 ? Math.round(grossOmzet / totalOrders) : 0;

      // Update DOM
      const omzetEl = document.getElementById('metric-omzet');
      const ordersCountEl = document.getElementById('metric-orders-count');
      const countLunasEl = document.getElementById('metric-count-lunas');
      const countPendingEl = document.getElementById('metric-count-pending');
      const aovEl = document.getElementById('metric-aov');
      const bestsellerEl = document.getElementById('metric-bestseller');

      if (omzetEl) omzetEl.textContent = formatIDR(grossOmzet);
      if (ordersCountEl) ordersCountEl.textContent = totalOrders;
      if (countLunasEl) countLunasEl.textContent = countLunas + countShipped;
      if (countPendingEl) countPendingEl.textContent = countPending;
      const sidebarPendingBadge = document.getElementById('sidebar-pending-badge');
      if (sidebarPendingBadge) sidebarPendingBadge.textContent = `${countPending} Baru`;
      if (aovEl) aovEl.textContent = formatIDR(aov);

      if (bestsellerEl) {
        const entries = Object.entries(productCount).sort((a, b) => b[1] - a[1]);
        bestsellerEl.textContent = entries.length > 0
          ? `Terlaris: ${entries[0][0]} (${entries[0][1]}x)`
          : 'Belum ada data penjualan';
      }

      await this.renderCriticalInventory();
    },

    async renderCriticalInventory() {
      const countEl = document.getElementById('metric-critical-count');
      const nameEl = document.getElementById('metric-critical-name');
      if (!countEl || !nameEl) return;

      try {
        const products = await window.RaidhaniData.getProducts();
        const critical = products.filter(p => (p.stock_count ?? 0) < 5 && p.stock_status !== 'sold_out');

        countEl.textContent = `${critical.length} SKU`;
        if (critical.length === 0) {
          nameEl.textContent = 'Semua stok aman';
        } else {
          const first = critical[0];
          nameEl.textContent = critical.length === 1
            ? `${first.name} (Sisa ${first.stock_count})`
            : `${first.name} (Sisa ${first.stock_count}) +${critical.length - 1} lainnya`;
        }
      } catch (e) {
        countEl.textContent = '—';
        nameEl.textContent = 'Gagal memuat data stok';
      }
    },

    // Ringkasan produk dalam 1 group jadi teks pendek untuk kolom tabel
    // / label, mis. "Halwa Luxury Syar'i Set" atau "Halwa Set +1 lainnya".
    summarizeItems(group, opts = {}) {
      const { maxChars = 40 } = opts;
      const qtyPrefix = (it) => (it.qty && it.qty > 1) ? `${it.qty}x ` : '';

      if (group.items.length === 1) {
        const it = group.items[0];
        return `${qtyPrefix(it)}${it.product_name} (${it.color} / ${it.size})`;
      }
      const first = group.items[0];
      const label = `${qtyPrefix(first)}${first.product_name} +${group.items.length - 1} produk lainnya`;
      return label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
    },

    renderTable() {
      const tbody = document.getElementById('orders-table-body');
      if (!tbody) return;

      const filtered = this.getFilteredGroups();
      tbody.innerHTML = '';

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-8 text-espresso-muted">
              Tidak ada pesanan yang sesuai dengan filter saat ini.
            </td>
          </tr>
        `;
        this.toggleOrderDetailEmptyState();
        return;
      }

      filtered.forEach(group => {
        const tr = document.createElement('tr');
        tr.className = `order-row cursor-pointer transition-colors${group.group_id === selectedGroupId ? ' selected' : ''}`;
        tr.onclick = () => this.selectOrder(group.group_id);

        let statusBadge = '';
        if (group.status === 'pending') {
          statusBadge = '<span class="status-badge pending"><span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;animation:pulse 1.5s ease-in-out infinite;display:inline-block;"></span> Verifikasi</span>';
        } else if (group.status === 'lunas') {
          statusBadge = '<span class="status-badge lunas"><span style="width:6px;height:6px;border-radius:50%;background:#059669;display:inline-block;"></span> Siap Kirim</span>';
        } else {
          statusBadge = '<span class="status-badge shipped"><span style="width:6px;height:6px;border-radius:50%;background:#0284C7;display:inline-block;"></span> Dikirim</span>';
        }

        const dateStr = group.created_at ? new Date(group.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : '—';
        const multiBadge = group.items.length > 1
          ? `<span class="badge badge-sage" style="font-size: 9px; padding: 1px 7px; margin-left: 6px;">${group.items.length} produk</span>`
          : '';

        tr.innerHTML = `
          <td class="py-3 px-3">
            <div class="flex flex-col">
              <span class="font-semibold text-terracotta-rich text-xs">#${group.group_id}${multiBadge}</span>
              <span class="text-[11px] text-espresso-muted">${dateStr}</span>
            </div>
          </td>
          <td class="py-3 px-3">
            <div class="flex flex-col">
              <span class="font-medium text-xs text-espresso-deep">${group.buyer_name}</span>
              <span class="text-[11px] text-espresso-muted">+${group.buyer_whatsapp}</span>
            </div>
          </td>
          <td class="py-3 px-3">
            <div class="flex flex-col">
              <span class="text-xs text-espresso-deep">${this.summarizeItems(group)}</span>
            </div>
          </td>
          <td class="py-3 px-3">
            <div class="flex flex-col">
              <span class="font-semibold text-xs text-espresso-deep">${formatIDR(group.total_price)}</span>
              ${group.coupon_code ? `<span class="text-[10px] text-terracotta-rich">Kupon: ${group.coupon_code}</span>` : ''}
            </div>
          </td>
          <td class="py-3 px-3">
            ${statusBadge}
          </td>
          <td class="py-3 px-3 text-right">
            <div class="flex items-center justify-end gap-1">
              ${group.status === 'pending' ? `
                <button class="px-3 py-1 bg-terracotta-rich text-white text-[11px] font-semibold rounded-full hover:bg-terracotta-soft transition-colors" onclick="event.stopPropagation(); RaidhaniAdminOrders.updateStatus('${group.group_id}', 'lunas')">
                  Konfirmasi Lunas
                </button>
              ` : `
                <button class="px-2.5 py-1 bg-surface-warm text-espresso-deep text-[11px] font-medium rounded-full hover:bg-border-subtle" onclick="event.stopPropagation(); RaidhaniAdminOrders.updateStatus('${group.group_id}', 'dikirim')">
                  Kirim
                </button>
              `}
            </div>
          </td>
        `;

        tbody.appendChild(tr);
      });

      // Render Active Order in inspection panel
      this.toggleOrderDetailEmptyState();
      if (selectedGroupId) {
        this.renderOrderDetail(selectedGroupId);
      }
    },

    toggleOrderDetailEmptyState() {
      const emptyState = document.getElementById('order-detail-empty-state');
      const content = document.getElementById('order-detail-content');
      const hasOrder = allGroups.length > 0 && Boolean(selectedGroupId);
      if (emptyState) emptyState.style.display = hasOrder ? 'none' : 'block';
      if (content) content.style.display = hasOrder ? 'block' : 'none';
    },

    renderPendingAlert() {
      const banner = document.getElementById('pending-alert-banner');
      const countBadge = document.getElementById('pending-alert-count');
      const detail = document.getElementById('pending-alert-detail');
      if (!banner) return;

      const pending = allGroups.filter(g => g.status === 'pending');
      if (pending.length === 0) {
        banner.style.display = 'none';
        return;
      }

      banner.style.display = 'flex';
      if (countBadge) countBadge.textContent = `${pending.length} Transaksi Baru`;
      if (detail) {
        const ids = pending.slice(0, 5).map(g => `#${g.group_id}`).join(', ');
        detail.textContent = `Menunggu verifikasi mutasi: ${ids}${pending.length > 5 ? `, +${pending.length - 5} lainnya` : ''}.`;
      }
    },

    renderRecentActivity() {
      const container = document.getElementById('recent-activity-list');
      if (!container) return;

      const recent = [...allGroups]
        .filter(g => g.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      if (recent.length === 0) {
        container.innerHTML = '<p style="color: #6E635E; text-align: center; padding: 12px 0;">Belum ada aktivitas transaksi.</p>';
        return;
      }

      container.innerHTML = recent.map((g, i) => {
        const timeStr = new Date(g.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        const isLast = i === recent.length - 1;
        return `
          <div style="${isLast ? '' : 'padding-bottom: 10px; border-bottom: 1px solid #ECE5DB;'}">
            <div style="display: flex; justify-content: space-between;">
              <strong>${g.payment_method || 'Transfer'} +${formatIDR(g.total_price)}</strong>
              <span style="color: #6E635E;">${timeStr}</span>
            </div>
            <span style="color: #737965;">${g.buyer_name} (#${g.group_id})</span>
          </div>
        `;
      }).join('');
    },

    renderLogistics() {
      const countEl = document.getElementById('logistics-ready-count');
      const tbody = document.getElementById('logistics-table-body');

      const ready = allGroups.filter(g => g.status === 'lunas');
      if (countEl) countEl.textContent = ready.length;

      const sidebarBadge = document.getElementById('sidebar-logistics-badge');
      if (sidebarBadge) sidebarBadge.textContent = `${ready.length} Pkt`;

      if (!tbody) return;

      if (ready.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-espresso-muted">Belum ada pesanan berstatus Lunas.</td></tr>';
        return;
      }

      tbody.innerHTML = ready.map(g => `
        <tr>
          <td><strong style="color: #9F6A54; font-size: 12px;">#${g.group_id}</strong></td>
          <td><strong style="font-size: 12px; color: #2E221E;">${g.buyer_name}</strong><br><span style="font-size: 11px; color: #6E635E;">+${g.buyer_whatsapp}</span></td>
          <td style="font-size: 12px; color: #2E221E;">${g.buyer_city_district || '—'}</td>
          <td style="font-size: 12px;">${this.summarizeItems(g, { maxChars: 60 })}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 11px;" onclick="RaidhaniAdminOrders.printThermalLabelFor('${g.group_id}')">Label</button>
          </td>
        </tr>
      `).join('');
    },

    selectOrder(groupId) {
      selectedGroupId = groupId;
      this.renderTable();
      const detailCard = document.getElementById('order-detail-card');
      if (detailCard) {
        detailCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },

    async updateStatus(groupId, newStatus) {
      const group = allGroups.find(g => g.group_id === groupId);
      const orderIds = group ? group.order_ids : [groupId];

      // Update SELURUH baris dalam group secara bersamaan — kalau cuma
      // 1 baris yang di-update, produk lain dalam order yang sama bisa
      // tertinggal berstatus pending walau pelanggan sudah bayar semua.
      await Promise.all(orderIds.map(id => window.RaidhaniData.updateOrderStatus(id, newStatus)));

      await this.loadOrders();
      await this.renderMetrics();
      this.renderTable();
      this.renderPendingAlert();
      this.renderRecentActivity();
      this.renderLogistics();
      if (window.showToast) {
        window.showToast(`Pesanan #${groupId} status diubah ke ${newStatus.toUpperCase()}`);
      }
    },

    renderOrderDetail(groupId) {
      const group = allGroups.find(g => g.group_id === groupId);
      if (!group) return;

      const titleEl = document.getElementById('detail-order-id');
      const nameEl = document.getElementById('detail-buyer-name');
      const waEl = document.getElementById('detail-buyer-wa');
      const waLinkEl = document.getElementById('detail-buyer-walink');
      const addrEl = document.getElementById('detail-buyer-address');
      const itemsListEl = document.getElementById('detail-items-list');
      const itemTotalEl = document.getElementById('detail-item-total');
      const couponTagEl = document.getElementById('detail-coupon-row');
      const statusBadgeEl = document.getElementById('detail-order-status');
      const confirmBtn = document.getElementById('btn-detail-confirm');
      const confirmText = document.getElementById('btn-detail-confirm-text');
      const mutasiNominalEl = document.getElementById('detail-mutasi-nominal');
      const mutasiSenderEl = document.getElementById('detail-mutasi-sender');

      const multiSuffix = group.items.length > 1 ? ` (${group.items.length} produk)` : '';
      if (titleEl) titleEl.textContent = `Pesanan #${group.group_id}${multiSuffix}`;
      if (nameEl) nameEl.textContent = group.buyer_name;
      if (waEl) waEl.textContent = `+${group.buyer_whatsapp}`;
      if (waLinkEl) waLinkEl.href = `https://wa.me/${group.buyer_whatsapp}`;
      if (addrEl) addrEl.textContent = `${group.buyer_address}, ${group.buyer_city_district} ${group.buyer_postal_code}`;

      if (itemsListEl) {
        itemsListEl.innerHTML = group.items.map(it => `
          <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
            <span style="color: #6E635E;">${it.qty || 1}x ${it.product_name} (${it.color} / ${it.size})</span>
            <strong style="color: #2E221E;">${formatIDR(it.total_price)}</strong>
          </div>
        `).join('');
      }
      if (itemTotalEl) itemTotalEl.textContent = formatIDR(group.total_price);

      if (mutasiNominalEl) mutasiNominalEl.textContent = `${group.payment_method || 'BSI/BCA Transfer'}: ${formatIDR(group.total_price)}`;
      if (mutasiSenderEl) mutasiSenderEl.textContent = `Pengirim: ${(group.buyer_name || '').toUpperCase()}`;

      const proofImg = document.getElementById('detail-proof-img');
      const proofLink = document.getElementById('detail-proof-link');
      const proofStatus = document.getElementById('detail-proof-status');
      if (group.payment_proof_url) {
        if (proofImg) { proofImg.src = group.payment_proof_url; proofImg.style.objectFit = 'cover'; }
        if (proofLink) proofLink.href = group.payment_proof_url;
        if (proofStatus) {
          proofStatus.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span><span>Bukti tersedia — klik untuk perbesar</span>';
        }
      } else {
        if (proofImg) { proofImg.src = 'media/brand/logo.png'; proofImg.style.objectFit = 'contain'; }
        if (proofLink) proofLink.removeAttribute('href');
        if (proofStatus) {
          proofStatus.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">hourglass_empty</span><span>Belum ada bukti diupload</span>';
        }
      }

      if (statusBadgeEl) {
        if (group.status === 'pending') {
          statusBadgeEl.className = 'status-badge pending';
          statusBadgeEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;display:inline-block;"></span> Perlu Verifikasi';
        } else if (group.status === 'lunas') {
          statusBadgeEl.className = 'status-badge lunas';
          statusBadgeEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#059669;display:inline-block;"></span> Siap Kirim';
        } else {
          statusBadgeEl.className = 'status-badge shipped';
          statusBadgeEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#0284C7;display:inline-block;"></span> Dikirim';
        }
      }

      if (confirmBtn && confirmText) {
        if (group.status === 'pending') {
          confirmBtn.disabled = false;
          confirmBtn.className = 'btn btn-primary btn-block';
          confirmText.textContent = 'Konfirmasi Lunas & Kirim WA';
        } else if (group.status === 'lunas') {
          confirmBtn.disabled = false;
          confirmBtn.className = 'btn btn-secondary btn-block';
          confirmText.textContent = 'Tandai Telah Diserahkan ke Kurir';
        } else {
          confirmBtn.disabled = true;
          confirmBtn.className = 'btn btn-secondary btn-block';
          confirmText.textContent = 'Pesanan Telah Dikirim (Selesai)';
        }
      }

      if (couponTagEl) {
        if (group.coupon_code) {
          couponTagEl.style.display = 'flex';
          couponTagEl.querySelector('.coupon-value').textContent = group.coupon_code;
        } else {
          couponTagEl.style.display = 'none';
        }
      }
    },

    async confirmCurrentOrder() {
      const group = allGroups.find(g => g.group_id === selectedGroupId);
      if (!group) return;

      const itemsSummary = group.items.map(it => `${it.qty || 1}x ${it.product_name} (${it.color})`).join(', ');

      if (group.status === 'pending') {
        await this.updateStatus(group.group_id, 'lunas');
        const message = `Halo Kak ${group.buyer_name}, terima kasih telah berbelanja di RAIDHANI Atelier.\n\nPembayaran pesanan #${group.group_id} (${itemsSummary}) senilai ${formatIDR(group.total_price)} telah BERHASIL DIVERIFIKASI LUNAS.\n\nTim atelier kami saat ini sedang menyiapkan kemasan pesanan Anda. Kami akan segera mengabarkan nomor resi saat paket diserahkan ke kurir. Terima kasih.`;
        window.open(`https://wa.me/${group.buyer_whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
        if (window.showToast) {
          window.showToast(`Pesanan #${group.group_id} Lunas! Membuka pesan konfirmasi WhatsApp.`);
        }
      } else if (group.status === 'lunas') {
        await this.updateStatus(group.group_id, 'dikirim');
        const message = `Halo Kak ${group.buyer_name}, pesanan #${group.group_id} di RAIDHANI Atelier telah diserahkan kepada kurir ekspedisi untuk pengiriman ke alamat tujuan (${group.buyer_city_district}). Semoga busana pilihan Kakak membawa kenyamanan dan keberkahan. Terima kasih.`;
        window.open(`https://wa.me/${group.buyer_whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
        if (window.showToast) {
          window.showToast(`Pesanan #${group.group_id} ditandai Dikirim! Membuka pesan resi WhatsApp.`);
        }
      }
    },

    printInvoice(groupId) {
      const targetId = groupId || selectedGroupId;
      const group = allGroups.find(g => g.group_id === targetId);
      if (!group) {
        alert('Pilih pesanan terlebih dahulu.');
        return;
      }

      const printWin = window.open('', '_blank', 'width=800,height=900');
      if (!printWin) {
        alert('Mohon izinkan pop-up browser untuk mencetak invoice.');
        return;
      }

      const itemRows = group.items.map(it => `
        <tr>
          <td><strong>${it.product_name}</strong></td>
          <td>${it.color} / ${it.size}</td>
          <td>${it.qty || 1}</td>
          <td>${formatIDR(it.unit_price || it.total_price)}</td>
          <td style="text-align: right;">${formatIDR(it.total_price)}</td>
        </tr>
      `).join('');

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Invoice #${group.group_id} - RAIDHANI Atelier</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E221E; padding: 40px; margin: 0; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2E221E; padding-bottom: 20px; margin-bottom: 30px; }
            .brand { font-size: 24px; font-weight: 700; letter-spacing: 0.15em; color: #2E221E; }
            .meta { font-size: 13px; color: #6E635E; line-height: 1.6; }
            .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            .table th, .table td { padding: 12px; border-bottom: 1px solid #ECE5DB; text-align: left; font-size: 13px; }
            .table th { background: #FAF8F5; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6E635E; }
            .total-row { font-size: 16px; font-weight: 700; color: #9F6A54; }
            .footer { margin-top: 50px; font-size: 11px; color: #6E635E; border-top: 1px solid #ECE5DB; padding-top: 20px; text-align: center; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #9F6A54; color: #FFF; border: none; border-radius: 9999px; cursor: pointer; font-weight: 600;">Cetak Struk Invoice</button>
          </div>
          <div class="header">
            <div>
              <div class="brand">RAIDHANI</div>
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #9F6A54; margin-top: 4px;">Quiet Luxury Modest Couture</div>
              <div class="meta" style="margin-top: 8px;">
                Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan<br>
                WhatsApp: +62 812-8912-3456 | raidhani.luxury
              </div>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 20px;">INVOICE PENJUALAN</h2>
              <div class="meta" style="margin-top: 6px;">
                <strong>No. Pesanan:</strong> #${group.group_id}<br>
                <strong>Tanggal:</strong> ${group.created_at ? group.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)}<br>
                <strong>Status Pembayaran:</strong> <span style="color: #737965; font-weight: 700;">${group.status.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px;">
            <div>
              <strong style="font-size: 12px; text-transform: uppercase; color: #6E635E;">Tujuan Pengiriman:</strong>
              <div style="font-size: 14px; font-weight: 700; margin: 4px 0 2px;">${group.buyer_name}</div>
              <div style="font-size: 12px; color: #6E635E; line-height: 1.5;">
                ${group.buyer_address}<br>
                ${group.buyer_city_district} ${group.buyer_postal_code}<br>
                No. Telp / WA: +${group.buyer_whatsapp}
              </div>
            </div>
            <div>
              <strong style="font-size: 12px; text-transform: uppercase; color: #6E635E;">Metode Pembayaran:</strong>
              <div style="font-size: 13px; margin-top: 4px; line-height: 1.6;">
                Metode: <strong>${group.payment_method || 'BSI/BCA Virtual Transfer'}</strong><br>
                Status Mutasi: <strong>Terverifikasi Cocok</strong><br>
                Catatan: <em>${group.buyer_notes || 'Kemasan rapi standard box.'}</em>
              </div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Deskripsi Produk</th>
                <th>Warna / Size</th>
                <th>Qty</th>
                <th>Harga Satuan</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
              ${group.coupon_code ? `
              <tr>
                <td colspan="4" style="color: #9F6A54;">Kupon Promosi Diterapkan (${group.coupon_code})</td>
                <td style="text-align: right; color: #9F6A54;">—</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="4" style="border-top: 2px solid #2E221E;">TOTAL PEMBAYARAN</td>
                <td style="text-align: right; border-top: 2px solid #2E221E;">${formatIDR(group.total_price)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            Dokumen resmi tanda terima transaksi diterbitkan secara elektronik oleh RAIDHANI Atelier Backoffice System.<br>
            Untuk penukaran ukuran atau pertanyaan kendala pengiriman, hubungi Concierge WhatsApp kami.
          </div>
        </body>
        </html>
      `);
      printWin.document.close();
    },

    printThermalLabel(groupId) {
      this.printThermalLabelFor(groupId || selectedGroupId);
    },

    printThermalLabelFor(groupId) {
      const group = allGroups.find(g => g.group_id === groupId);
      if (!group) {
        alert('Data pesanan tidak ditemukan.');
        return;
      }

      const printWin = window.open('', '_blank', 'width=450,height=650');
      if (!printWin) {
        alert('Mohon izinkan pop-up browser untuk mencetak label.');
        return;
      }

      const totalQty = group.items.reduce((sum, it) => sum + (it.qty || 1), 0);
      const itemsHtml = group.items.map(it => `${it.product_name} — ${it.color} (${it.size}) x${it.qty || 1}`).join('<br>');

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Label Thermal #${group.group_id}</title>
          <style>
            @page { size: 100mm 150mm; margin: 4mm; }
            body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; color: #000; box-sizing: border-box; }
            .box { border: 2px solid #000; padding: 10px; border-radius: 4px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
            .barcode { font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 0.15em; text-align: center; margin: 10px 0; border: 1px dashed #000; padding: 6px; }
            .section { border-bottom: 1px solid #000; padding: 8px 0; }
            .strong { font-weight: 700; }
            .addr { font-size: 12px; line-height: 1.4; margin-top: 4px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 12px; text-align: center;">
            <button onclick="window.print()" style="padding: 8px 18px; font-weight: bold; background: #000; color: #FFF; border: none; cursor: pointer;">Cetak Thermal Label (100x150mm)</button>
          </div>
          <div class="box">
            <div class="header">
              <div>
                <strong style="font-size: 16px;">RAIDHANI ATELIER</strong><br>
                <span>PAKET BUTIK FRAGILE</span>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 16px; font-weight: 900;">JNE REG</span><br>
                <span>NON-COD</span>
              </div>
            </div>

            <div class="barcode">
              ||| ||||| |||| |||| ||| ||||<br>
              <span style="font-size: 13px;">${group.group_id}</span>
            </div>

            <div class="section">
              <span class="strong">PENERIMA:</span>
              <div class="addr">
                <strong style="font-size: 14px;">${group.buyer_name}</strong><br>
                Telp: +${group.buyer_whatsapp}<br>
                ${group.buyer_address}<br>
                <strong>${group.buyer_city_district} ${group.buyer_postal_code}</strong>
              </div>
            </div>

            <div class="section">
              <span class="strong">PENGIRIM:</span>
              <div class="addr">
                <strong>RAIDHANI Flagship Atelier</strong> (0812-8912-3456)<br>
                Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan 12190
              </div>
            </div>

            <div class="section" style="border-bottom: none;">
              <div style="display: flex; justify-content: space-between;">
                <div>
                  <span class="strong">ISI PAKET (${totalQty} pcs):</span><br>
                  ${itemsHtml}
                </div>
                <div style="text-align: right;">
                  <span class="strong">BERAT:</span><br>
                  ${totalQty}.00 Kg
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #000; padding-top: 4px;">
                Catatan: <em>${group.buyer_notes || 'Harap ditangani dengan hati-hati. Busana sutra/katun mewah.'}</em>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      printWin.document.close();
    },

    printCourierManifest() {
      const ready = allGroups.filter(g => g.status === 'lunas');
      if (ready.length === 0) {
        alert('Belum ada pesanan berstatus Lunas untuk dimasukkan ke manifest.');
        return;
      }

      const printWin = window.open('', '_blank', 'width=850,height=650');
      if (!printWin) {
        alert('Mohon izinkan pop-up browser untuk mencetak manifest.');
        return;
      }

      const rowsHtml = ready.map((g, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>#${g.group_id}</td>
          <td>${g.buyer_name}</td>
          <td>${g.buyer_city_district || '—'}</td>
          <td>${this.summarizeItems(g, { maxChars: 60 })}</td>
          <td>[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
        </tr>
      `).join('');

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Manifest Serah Terima Ekspedisi</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; padding: 30px; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            th { background: #eee; }
            .sign-box { display: flex; justify-content: space-around; margin-top: 40px; text-align: center; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 16px;">
            <button onclick="window.print()" style="padding: 8px 16px; font-weight: bold; background: #9F6A54; color: #FFF; border: none; cursor: pointer;">Cetak Lembar Serah Terima</button>
          </div>
          <h2>LEMBAR MANIFEST SERAH TERIMA LOGISTIK</h2>
          <p>
            <strong>Tanggal &amp; Waktu Cetak:</strong> ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB<br>
            <strong>Lokasi Atelier:</strong> RAIDHANI Flagship Studio, Jl. Senopati No. 42 Jakarta Selatan<br>
            <strong>Mitra Ekspedisi:</strong> Diisi manual oleh petugas saat serah terima
          </p>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Order ID</th>
                <th>Nama Penerima</th>
                <th>Kota Tujuan</th>
                <th>Item</th>
                <th>Paraf Petugas Ekspedisi</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="sign-box">
            <div>
              <p>Diserahkan Oleh (Staff Atelier):</p>
              <br><br>
              <strong>( Atelier Operations )</strong>
            </div>
            <div>
              <p>Diterima Oleh (Driver Kurir):</p>
              <br><br>
              <strong>( ..................................... )</strong>
            </div>
          </div>
        </body>
        </html>
      `);
      printWin.document.close();
    },

    exportCSV() {
      // Ekspor tetap per baris produk (bukan per group) supaya data
      // mentah untuk pembukuan/inventaris tidak hilang detail — tapi
      // kolom Order Group ID ditambahkan supaya tetap bisa dikaitkan.
      const filteredGroupIds = new Set(this.getFilteredGroups().map(g => g.group_id));
      const rows = allOrders.filter(o => filteredGroupIds.has(o.order_group_id || o.order_id));

      if (rows.length === 0) {
        alert('Tidak ada data untuk diekspor.');
        return;
      }

      const headers = ['Order ID', 'Order Group ID', 'Tanggal', 'Nama Pembeli', 'No WhatsApp', 'Produk', 'Warna', 'Ukuran', 'Qty', 'Total Tagihan', 'Kode Kupon', 'Alamat Lengkap', 'Kota/Kecamatan', 'Kode Pos', 'Status'];

      const csvRows = [
        headers.join(',')
      ];

      rows.forEach(o => {
        const row = [
          `"${o.order_id}"`,
          `"${o.order_group_id || o.order_id}"`,
          `"${o.created_at ? o.created_at.slice(0, 10) : ''}"`,
          `"${(o.buyer_name || '').replace(/"/g, '""')}"`,
          `"${o.buyer_whatsapp}"`,
          `"${(o.product_name || '').replace(/"/g, '""')}"`,
          `"${o.color}"`,
          `"${o.size}"`,
          o.qty || 1,
          o.total_price,
          `"${o.coupon_code || ''}"`,
          `"${(o.buyer_address || '').replace(/"/g, '""')}"`,
          `"${(o.buyer_city_district || '').replace(/"/g, '""')}"`,
          `"${o.buyer_postal_code || ''}"`,
          `"${o.status}"`
        ];
        csvRows.push(row.join(','));
      });

      const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RAIDHANI-Orders-Export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  window.RaidhaniAdminOrders = RaidhaniAdminOrders;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniAdminOrders.init());
  } else {
    RaidhaniAdminOrders.init();
  }

})(window);
