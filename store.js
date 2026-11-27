import { firebaseConfig } from './firebase-config.js';
export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
export async function createStore(demo) {
  if (demo) return createDemoStore();
  if (!configured) throw new Error('Firebase 연결 설정이 필요해요. 먼저 체험 모드로 살펴보세요.');
  const [app, auth, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js')
  ]);
  const instance = app.initializeApp(firebaseConfig), authentication = auth.getAuth(instance);
  await auth.setPersistence(authentication, auth.browserLocalPersistence);
  await authentication.authStateReady();
  const user = authentication.currentUser || (await auth.signInAnonymously(authentication)).user;
  const db = fs.getFirestore(instance), uid = user.uid;
  const roomRef = id => fs.doc(db, 'rooms', id);
  return {
    uid,
    async create(data) {
      const ref = fs.doc(fs.collection(db, 'rooms'));
      await fs.setDoc(ref, {...data, owner:uid, finalStart:'', createdAt:fs.serverTimestamp()});
      return ref.id;
    },
    watch(id, onRoom, onMembers, onError) {
      const a = fs.onSnapshot(roomRef(id), {includeMetadataChanges:true}, s => {
        if (!s.exists() && s.metadata.fromCache) return;
        onRoom(s.exists() ? {id:s.id, ...s.data()} : null);
      }, onError);
      const b = fs.onSnapshot(fs.collection(db,'rooms',id,'members'), {includeMetadataChanges:true}, s => {
        onMembers(s.docs.map(d => ({uid:d.id,...d.data()})), s.metadata.fromCache);
      }, onError);
      return () => { a(); b(); };
    },
    async save(id, name, dates) { await fs.setDoc(fs.doc(db,'rooms',id,'members',uid), {name,dates,updatedAt:fs.serverTimestamp()}); },
    async finalize(id, finalStart) { await fs.updateDoc(roomRef(id), {finalStart}); },
    async removeVote(id) { await fs.deleteDoc(fs.doc(db,'rooms',id,'members',uid)); }
  };
}
function createDemoStore() {
  const key = 'trip-together-demo-v1';
  let data;
  try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch { data = {}; }
  let listener;
  const persist = () => { localStorage.setItem(key,JSON.stringify(data)); listener?.(); };
  const uid = 'demo-me';
  return {
    uid,
    async create(room) {
      const id = 'demo-' + crypto.randomUUID();
      data[id] = {...room, id, owner:uid, finalStart:'', members:[]};
      persist(); return id;
    },
    watch(id,onRoom,onMembers) {
      listener = () => { const room=data[id]; onRoom(room || null); onMembers(room?.members || [],false); };
      listener(); return () => { listener = null; };
    },
    async save(id,name,dates) {
      if(data[id].finalStart) throw new Error('확정된 여행은 응답을 바꿀 수 없어요.');
      data[id].members = data[id].members.filter(m=>m.uid!==uid).concat({uid,name,dates}); persist();
    },
    async finalize(id,finalStart) { data[id].finalStart=finalStart; persist(); },
    async removeVote(id) { data[id].members=data[id].members.filter(m=>m.uid!==uid); persist(); }
  };
}
