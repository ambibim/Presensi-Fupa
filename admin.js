// ————————————————— Initialization —————————————————
const firebaseConfig = {
  apiKey: "AIzaSyA-xV3iuv-KAE_-xhiXZSPCTn54EgYUD40",
  authDomain: "presensi-online-f0964.firebaseapp.com",
  projectId: "presensi-online-f0964",
  storageBucket: "presensi-online-f0964.firebasestorage.app",
  messagingSenderId: "895308244103",
  appId: "1:895308244103:web:ab240a8be762a44f49c422",
  measurementId: "G-E9C7760C2S"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

const adminUIDs = [
  "odO8ZtMgTKeao0SDuy9L3gUmkx02",
  "ujHnWTnftGh6scTI8cQyN8fhmOB2"
];
const staffUIDs = [
  "HD4EsoL2ykgwQeBl6RP1WfrcCKw1",
  "FD69ceLyhqedlBfhbLb2I0TljY03",
  "h5aw8ppJSgP9PQM0Oc2HtugUAH02"
];

// ————————————————— Auth Guard —————————————————
auth.onAuthStateChanged(user => {
  if (!user) return location.href = 'index.html';
  if (!adminUIDs.includes(user.uid)) return location.href = 'karyawan.html';
  initAdminPage();
});

// ————————————————— Init Admin Page —————————————————
function initAdminPage() {
  setupDateTime();
  setupProfilePopup();
  setupNotifPopup();
  setupAnnPopup();
  setupAccountCreation();
  setupFiltersAndTable();
}

// ————————————————— 1. Waktu Server (client) —————————————————
function setupDateTime() {
  const elTime = document.getElementById('serverTime');
  const elDate = document.getElementById('serverDate');
  setInterval(() => {
    const now = new Date();
    elTime.textContent = now.toLocaleTimeString();
    elDate.textContent = now.toLocaleDateString();
  }, 500);
}

// ————————————————— 2. Profile & Create Account —————————————————
function setupProfilePopup() {
  const modal   = document.getElementById('modalProfile');
  const btnOpen = document.getElementById('profileIcon');
  const btnClose= modal.querySelector('[data-close]');
  const inpPic  = document.getElementById('inpProfilePic');
  const inpName = document.getElementById('inpName');
  const inpAddr = document.getElementById('inpAddress');
  const btnSave = document.getElementById('btnSaveProfile');
  const btnLogout = document.getElementById('btnLogout');
  const newEmail = document.getElementById('newEmail');
  const newPass  = document.getElementById('newPass');
  const newUID   = document.getElementById('newUID');
  const btnCreate= document.getElementById('btnCreateAccount');

  btnOpen.onclick   = ()=> modal.style.display='flex';
  btnClose.onclick  = ()=> modal.style.display='none';
  modal.onclick     = e=> { if(e.target===modal) modal.style.display='none'; };

  // Load profile data
  auth.onAuthStateChanged(user => {
    if (user) {
      inpName.value = user.displayName || '';
      // alamat disimpan di Firestore /users/{uid}
      db.collection('users').doc(user.uid).get()
        .then(doc => {
          inpAddr.value = doc.exists? doc.data().address || '':'';
        });
    }
  });

  // Update profile
  btnSave.onclick = async () => {
    const user = auth.currentUser;
    let photoURL = user.photoURL || null;

    if (inpPic.files.length) {
      const form = new FormData();
      form.append('file', inpPic.files[0]);
      form.append('upload_preset','presensi_unsigned');
      const res = await fetch(
        'https://api.cloudinary.com/v1_1/dn2o2vf04/upload',
        { method:'POST', body:form }
      );
      const data = await res.json();
      photoURL = data.secure_url;
    }

    await user.updateProfile({ displayName: inpName.value, photoURL });
    await db.collection('users').doc(user.uid).set({
      name: inpName.value,
      address: inpAddr.value,
      photoURL
    }, { merge:true });

    alert('Profile diperbarui');
    modal.style.display='none';
  };

  // Logout
  btnLogout.onclick = ()=> auth.signOut().then(_=> location.href='index.html');

  // Buat akun karyawan
  btnCreate.onclick = async () => {
    const email = newEmail.value.trim();
    const pass  = newPass.value.trim();
    const uid   = newUID.value.trim();
    if(!email||!pass||!uid) {
      return alert('Email, password & UID wajib diisi.');
    }
    try {
      // 1) Auth: create
      const { user } = await auth.createUserWithEmailAndPassword(email, pass);
      // 2) Set custom UID in Firestore
      await db.collection('users').doc(uid).set({
        email, role:'karyawan'
      });
      alert(`Akun karyawan dengan UID “${uid}” berhasil dibuat`);
      newEmail.value=newPass.value=newUID.value='';
    }
    catch(err) {
      console.error(err);
      alert('Gagal buat akun: '+err.message);
    }
  };
}

// ————————————————— 3. Popup Cuti (Admin) —————————————————
function setupNotifPopup() {
  const modal   = document.getElementById('modalNotif');
  const btnOpen = document.getElementById('notifIcon');
  const btnClose= modal.querySelector('[data-close]');
  const list    = document.getElementById('cutiList');

  btnOpen.onclick   = ()=> { modal.style.display='flex'; loadCutiRequests(); };
  btnClose.onclick  = ()=> modal.style.display='none';
  modal.onclick     = e=> { if(e.target===modal) modal.style.display='none'; };

  async function loadCutiRequests() {
    list.innerHTML = '';
    const snap = await db.collection('cuti')
      .where('status','==','pending')
      .orderBy('createdAt','desc')
      .get();

    snap.forEach(doc => {
      const d = doc.data();
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${d.uid} – ${d.type} (${d.date})</span>
        <div>
          <button class="btn-approve">✅</button>
          <button class="btn-reject">❌</button>
        </div>
      `;
      // Approve
      li.querySelector('.btn-approve').onclick = async ()=>{
        await doc.ref.update({ status:'approved' });
        await db.collection('notifications').add({
          targetUid: d.uid,
          text: `Cuti Anda (${d.type} ${d.date}) disetujui.`,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        li.remove();
      };
      // Reject
      li.querySelector('.btn-reject').onclick = async ()=>{
        await doc.ref.update({ status:'rejected' });
        await db.collection('notifications').add({
          targetUid: d.uid,
          text: `Cuti Anda (${d.type} ${d.date}) ditolak.`,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        li.remove();
      };
      list.appendChild(li);
    });
  }
}

// ————————————————— 4. Popup Pengumuman & Wajib Presensi —————————————————
function setupAnnPopup() {
  const modal   = document.getElementById('modalAnn');
  const btnOpen = document.getElementById('fabAnn');
  const btnClose= modal.querySelector('[data-close]');
  const chk     = document.getElementById('toggleWajib');
  const textarea= document.getElementById('annText');
  const btnSend = document.getElementById('btnSendAnn');

  btnOpen.onclick   = ()=> { 
    modal.style.display='flex'; 
    // load setting hari wajib
    db.collection('settings').doc('hari').get()
      .then(doc=> {
        chk.checked = doc.exists && doc.data().sundayMandatory;
      });
  };
  btnClose.onclick  = ()=> modal.style.display='none';
  modal.onclick     = e=> { if(e.target===modal) modal.style.display='none'; };

  // Kirim & simpan
  btnSend.onclick = async () => {
    // 1) Update setting wajib presensi
    await db.collection('settings').doc('hari')
      .set({ sundayMandatory: chk.checked },{ merge:true });
    // 2) Broadcast announcement
    const text = textarea.value.trim();
    if(text) {
      const batch = db.batch();
      staffUIDs.forEach(uid=>{
        const ref = db.collection('notifications').doc();
        batch.set(ref, {
          targetUid: uid,
          text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      alert('Pengumuman terkirim ke semua karyawan');
      textarea.value = '';
    }
    modal.style.display='none';
  };
}

// ————————————————— 5. Filter & Tabel + Export CSV + Delete —————————————————
function setupFiltersAndTable() {
  const btnApply = document.getElementById('btnApplyFilter');
  const btnExport= document.getElementById('btnExportCSV');
  let currentData = [];

  btnApply.onclick = loadTable;
  btnExport.onclick= ()=> exportCSV(currentData);

  loadTable(); // load awal

  async function loadTable() {
    const nameF   = document.getElementById('filterName').value.toLowerCase();
    const from    = document.getElementById('dateFrom').value;
    const to      = document.getElementById('dateTo').value;
    const period  = document.getElementById('periodType').value;
    const tbody   = document.getElementById('tableBody');
    tbody.innerHTML = '';
    currentData = [];

    // ambil semua presensi
    let snap = await db.collection('presensi')
      .orderBy('timestamp','desc')
      .get();

    // filter manual client
    snap.forEach(doc => {
      const d = { id: doc.id, ...doc.data() };
      const dt = d.timestamp ? d.timestamp.toDate() : new Date();
      let pass = true;

      // nama
      if (nameF && !d.nama.toLowerCase().includes(nameF)) pass = false;

      // rentang tanggal
      if (from && dt < new Date(from)) pass = false;
      if (to   && dt > new Date(to+" 23:59")) pass = false;

      // periodik
      const now = new Date();
      if (period==='daily' && dt.toDateString()!==now.toDateString()) pass = false;
      if (period==='weekly') {
        const oneWeekAgo = new Date(now - 7*24*3600*1000);
        if (dt < oneWeekAgo) pass = false;
      }
      if (period==='monthly' && dt.getMonth()!== now.getMonth()) pass = false;
      if (period==='yearly' && dt.getFullYear()!== now.getFullYear()) pass = false;

      if (pass) {
        currentData.push(d);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${d.nama}</td>
          <td>${d.tipe}</td>
          <td>${d.status}</td>
          <td>${dt.toLocaleString()}</td>
          <td>${d.coords}</td>
          <td>
            <button class="btn-delete">Hapus</button>
          </td>
        `;
        // delete handler
        tr.querySelector('.btn-delete').onclick = () => {
          if (confirm('Hapus presensi ini?')) {
            deleteEntry(d.id, d.deleteToken);
            tr.remove();
          }
        };
        tbody.appendChild(tr);
      }
    });
  }

  // Export CSV
  function exportCSV(data) {
    if (!data.length) return alert('Tidak ada data untuk diexport.');
    const header = ['Nama','Tipe','Status','Waktu','Koordinat'];
    const rows = data.map(d => {
      const dt = d.timestamp? d.timestamp.toDate().toLocaleString() : '';
      return [d.nama,d.tipe,d.status,dt,d.coords];
    });
    const csv = [
      header.join(','), 
      ...rows.map(r=> r.map(v=> `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `presensi_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Delete Firestore + Cloudinary (via delete_by_token)
  async function deleteEntry(docId, deleteToken) {
    // 1) Hapus Cloudinary jika token ada
    if (deleteToken) {
      await fetch(
        'https://api.cloudinary.com/v1_1/dn2o2vf04/delete_by_token',
        {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ token: deleteToken })
        }
      );
    }
    // 2) Hapus Firestore
    await db.collection('presensi').doc(docId).delete();
  }
}