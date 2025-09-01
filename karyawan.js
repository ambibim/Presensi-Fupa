// ————————————————————————————————————
// Firebase Init
// ————————————————————————————————————
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

// Role UIDs (karyawan saja)
const staffUIDs = [
  "HD4EsoL2ykgwQeBl6RP1WfrcCKw1",
  "FD69ceLyhqedlBfhbLb2I0TljY03",
  "h5aw8ppJSgP9PQM0Oc2HtugUAH02"
];

// ————————————————————————————————————
// Prevent direct access & redirect
// ————————————————————————————————————
auth.onAuthStateChanged(user => {
  if (!user) {
    return location.href = 'index.html';
  }
  if (!staffUIDs.includes(user.uid)) {
    return location.href = 'admin.html';
  }
  initPage();
});

// ————————————————————————————————————
// Inisialisasi Page
// ————————————————————————————————————
async function initPage() {
  setupDateTime();
  setupGeo();
  setupCamera();
  setupProfilePopup();
  setupNotifPopup();
  setupCutiPopup();
}

// ————————————————————————————————————
// 1. Waktu & Tanggal (Client time)
// ————————————————————————————————————
function setupDateTime() {
  const elTime = document.querySelector('#dateTime span:first-child');
  const elDate = document.getElementById('date');
  setInterval(() => {
    const now = new Date();
    elTime.textContent = now.toLocaleTimeString();
    elDate.textContent = now.toLocaleDateString();
  }, 500);
}

// ————————————————————————————————————
// 2. Geolocation
// ————————————————————————————————————
function setupGeo() {
  const elCoords = document.querySelector('#coords span');
  if (!navigator.geolocation) {
    elCoords.textContent = 'Tidak tersedia';
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    elCoords.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }, err => {
    elCoords.textContent = 'Error izin lokasi';
  }, { enableHighAccuracy:true, timeout:10000 });
}

// ————————————————————————————————————
// 3. Kamera, Snap & Upload
// ————————————————————————————————————
function setupCamera() {
  const video     = document.getElementById('video');
  const canvas    = document.getElementById('canvas');
  const btnSnap   = document.getElementById('btnSnap');
  const btnUpload = document.getElementById('btnUpload');
  let blobPhoto;

  // akses kamera
  navigator.mediaDevices.getUserMedia({ video:true })
    .then(stream => { video.srcObject = stream; })
    .catch(()=> alert('Gagal akses kamera'));

  // ambil foto
  btnSnap.addEventListener('click', ()=>{
    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0,0);
    canvas.style.display = 'block';
    video.style.display = 'none';

    // kompres
    canvas.toBlob(b => {
      blobPhoto = b;
      btnUpload.disabled = false;
    }, 'image/jpeg', 0.5);
  });

  // upload ke Cloudinary + simpan Firestore
  btnUpload.addEventListener('click', async ()=>{
    if (!blobPhoto) return;
    btnUpload.textContent = 'Mengirim...';
    btnUpload.disabled = true;

    // ambil user, coords, datetime, tipe
    const user = auth.currentUser;
    const type = document.querySelector('input[name=typePresensi]:checked').value;
    const coordsText = document.querySelector('#coords span').textContent;
    const now = new Date();
    // status
    const jam = now.getHours() + now.getMinutes()/60;
    let status = 'Tepat Waktu';
    if (type==='berangkat') {
      if (jam>5.5) status = jam>6? 'Terlambat':'Terlambat';
    } else {
      if (jam<10 || jam>11.5) status = 'Terlambat'; 
    }

    try {
      // Cloudinary upload
      const form = new FormData();
      form.append('file', blobPhoto);
      form.append('upload_preset','presensi_unsigned');
      const res = await fetch(
        'https://api.cloudinary.com/v1_1/dn2o2vf04/upload',
        { method:'POST', body: form }
      );
      const imgData = await res.json();

      // simpan Firestore
      await db.collection('presensi').add({
        uid: user.uid,
        nama: user.displayName || user.email,
        tipe: type,
        status,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        coords: coordsText,
        photoUrl: imgData.secure_url
      });

      alert('Presensi berhasil tercatat!');
      // reset UI
      canvas.style.display = 'none';
      video.style.display = 'block';
      btnUpload.textContent = '⬆️ Upload';
    }
    catch(err) {
      console.error(err);
      alert('Upload gagal: '+err.message);
    }
    finally {
      btnUpload.disabled = true;
    }
  });
}

// ————————————————————————————————————
// 4. Profile Popup: tampil, simpan & logout
// ————————————————————————————————————
function setupProfilePopup() {
  const modal   = document.getElementById('modalProfile');
  const btnOpen = document.getElementById('profileIcon');
  const btnClose = modal.querySelector('[data-close]');
  const inpPic  = document.getElementById('inpProfilePic');
  const inpName = document.getElementById('inpName');
  const inpAddr = document.getElementById('inpAddress');
  const btnSave = document.getElementById('btnSaveProfile');
  const btnLogout = document.getElementById('btnLogout');

  btnOpen.onclick = ()=> modal.style.display='flex';
  btnClose.onclick = ()=> modal.style.display='none';
  modal.onclick = e=> { if(e.target===modal) modal.style.display='none'; };

  // load data
  auth.onAuthStateChanged(user=>{
    if (user) {
      inpName.value = user.displayName || '';
      inpAddr.value = ''; // bisa disimpan di Firestore profile/user.uid
    }
  });

  // simpan profile
  btnSave.addEventListener('click', async ()=>{
    const user = auth.currentUser;
    let photoURL = user.photoURL || null;

    // jika ada gambar baru
    if (inpPic.files.length) {
      const picBlob = inpPic.files[0];
      const form = new FormData();
      form.append('file', picBlob);
      form.append('upload_preset','presensi_unsigned');
      const res = await fetch(
        'https://api.cloudinary.com/v1_1/dn2o2vf04/upload',
        { method:'POST', body: form }
      );
      const data = await res.json();
      photoURL = data.secure_url;
    }

    // update Auth profile
    await user.updateProfile({ displayName: inpName.value, photoURL });
    // update Firestore user profile
    await db.collection('users').doc(user.uid).set({
      name: inpName.value,
      address: inpAddr.value,
      photoURL
    }, { merge:true });

    alert('Profile diperbarui');
    modal.style.display='none';
  });

  // logout
  btnLogout.addEventListener('click', ()=>{
    auth.signOut().then(_=> location.href='index.html');
  });
}

// ————————————————————————————————————
// 5. Notifikasi Popup
// ————————————————————————————————————
function setupNotifPopup() {
  const modal   = document.getElementById('modalNotif');
  const btnOpen = document.getElementById('notifIcon');
  const btnClose = modal.querySelector('[data-close]');
  const list    = document.getElementById('notifList');

  btnOpen.onclick = ()=> { modal.style.display='flex'; loadNotifs(); };
  btnClose.onclick = ()=> modal.style.display='none';
  modal.onclick = e=> { if(e.target===modal) modal.style.display='none'; };

  async function loadNotifs() {
    list.innerHTML = '';
    const user = auth.currentUser;
    const snap = await db.collection('notifications')
      .where('targetUid','==', user.uid)
      .orderBy('createdAt','desc')
      .limit(20)
      .get();
    snap.forEach(doc=>{
      const data = doc.data();
      const li = document.createElement('li');
      li.textContent = data.text;
      list.appendChild(li);
    });
  }
}

// ————————————————————————————————————
// 6. Popup Cuti
// ————————————————————————————————————
function setupCutiPopup() {
  const modal   = document.getElementById('modalCuti');
  const fab     = document.getElementById('fabCuti');
  const btnClose = modal.querySelector('[data-close]');
  const selType = document.getElementById('selectCutiType');
  const selDate = document.getElementById('selectCutiDate');
  const btnSend = document.getElementById('btnSubmitCuti');

  fab.onclick    = ()=> modal.style.display='flex';
  btnClose.onclick = ()=> modal.style.display='none';
  modal.onclick  = e=> { if(e.target===modal) modal.style.display='none'; };

  btnSend.addEventListener('click', async ()=>{
    const user = auth.currentUser;
    await db.collection('cuti').add({
      uid: user.uid,
      type: selType.value,
      date: selDate.value,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Permintaan cuti terkirim.');
    modal.style.display='none';
  });
}