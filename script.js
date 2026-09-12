document.addEventListener("DOMContentLoaded", () => {
    if (typeof firebase === "undefined" || !CONFIG.FIREBASE_CONFIG.apiKey) {
        alert("Firebase غير مضبوط في config.js");
        return;
    }
    firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
    const db = firebase.database();
    const coursesRef = db.ref("courses");
    const homeworkRef = db.ref(CONFIG.HOMEWORK_PATH || "homework");

    let currentSubject = "math", currentView = "courses", isAdmin = false;
    let courses = [], homework = [], favorites = JSON.parse(localStorage.getItem("favoriteCourses") || "[]");
    let calcExpr = "", lastAnswer = 0, angleMode = "DEG";

    const $ = id => document.getElementById(id);
    const tabBtns = document.querySelectorAll(".tab-btn");

    function esc(s="") { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
    function getYoutubeId(url="") {
        const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^#&?/\s]{11})/);
        return m ? m[1] : null;
    }
    function adminPassword() { return localStorage.getItem("DYNAMIC_ADMIN_PASSWORD") || CONFIG.ADMIN_PASSWORD; }

    function showView(view) {
        currentView = view;
        $("coursesView").classList.toggle("hidden", view !== "courses");
        $("homeworkView").classList.toggle("hidden", view !== "homework");
        $("favoritesView").classList.toggle("hidden", view !== "favorites");
        $("calculatorView").classList.toggle("hidden", view !== "calculator");
        $("searchSection").classList.toggle("hidden", view === "calculator");
        $("adminSection").classList.toggle("hidden", !isAdmin || view !== "courses");
        $("homeworkAdminSection").classList.toggle("hidden", !isAdmin || view !== "homework");
        if (view === "courses") renderCourses();
        if (view === "homework") renderHomework();
        if (view === "favorites") renderFavorites();
    }

    function sortItems(items) {
        const mode = $("sortSelect").value;
        return [...items].sort((a,b) => {
            if (mode === "az" || mode === "za") return (a.title||"").localeCompare(b.title||"", "ar") * (mode==="az"?1:-1);
            const ad = a.createdAt || 0, bd = b.createdAt || 0;
            return mode === "oldest" ? ad-bd : bd-ad;
        });
    }
    function queryFilter(items) {
        const q = $("searchInput").value.trim().toLowerCase();
        return q ? items.filter(x => (x.title||"").toLowerCase().includes(q)) : items;
    }

    function renderCourses() {
        const subject = CONFIG.SUBJECTS.find(s=>s.id===currentSubject);
        $("currentSubjectTitle").textContent = `دروس ${subject ? subject.name : ""}`;
        let list = queryFilter(courses.filter(c=>c.subject===currentSubject));
        list = sortItems(list);
        $("coursesCount").textContent = `${list.length} دروس`;
        $("coursesGrid").innerHTML = list.map(courseCard).join("");
        $("emptyState").classList.toggle("hidden", list.length !== 0);
        attachCourseEvents();
    }
    function courseCard(c) {
        const vid = getYoutubeId(c.url);
        const thumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : "";
        const fav = favorites.includes(c.id);
        return `<article class="course-card">
            <div class="thumb-container" data-url="${esc(c.url)}" data-title="${esc(c.title)}">
                ${thumb ? `<img src="${thumb}" alt="${esc(c.title)}" loading="lazy">` : `<div class="no-thumb"><i class="fa-solid fa-video"></i></div>`}
                <i class="fa-solid fa-circle-play play-icon"></i>
            </div>
            <div class="card-body"><h3 class="course-title">${esc(c.title)}</h3>
            <div class="card-actions"><button class="favorite-btn ${fav?'fav-active':''}" data-fav="${c.id}" title="المفضلة"><i class="${fav?'fa-solid':'fa-regular'} fa-star"></i></button>
            ${isAdmin ? `<button class="btn btn-secondary btn-sm edit-btn" data-id="${c.id}"><i class="fa-solid fa-pen"></i> تعديل</button><button class="btn btn-danger btn-sm delete-btn" data-id="${c.id}"><i class="fa-solid fa-trash"></i> حذف</button>` : ""}</div></div>
        </article>`;
    }
    function attachCourseEvents() {
        document.querySelectorAll(".thumb-container").forEach(el=>el.onclick=()=> {
            const id=getYoutubeId(el.dataset.url);
            if(!id) return alert("رابط الفيديو غير صالح!");
            $("youtubeIframe").src=`https://www.youtube.com/embed/${id}?autoplay=1`;
            $("modalVideoTitle").textContent=el.dataset.title; $("videoModal").classList.remove("hidden");
        });
        document.querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>toggleFavorite(b.dataset.fav));
        document.querySelectorAll(".edit-btn").forEach(b=>b.onclick=()=>editCourse(b.dataset.id));
        document.querySelectorAll(".delete-btn").forEach(b=>b.onclick=()=>deleteCourse(b.dataset.id));
    }
    function toggleFavorite(id) {
        favorites = favorites.includes(id) ? favorites.filter(x=>x!==id) : [...favorites,id];
        localStorage.setItem("favoriteCourses", JSON.stringify(favorites));
        if(currentView==="courses") renderCourses(); else renderFavorites();
    }
    function renderFavorites() {
        const list = queryFilter(sortItems(courses.filter(c=>favorites.includes(c.id))));
        $("favoritesCount").textContent=`${list.length} دروس`;
        $("favoritesGrid").innerHTML=list.map(courseCard).join("");
        $("favoritesEmpty").classList.toggle("hidden", list.length!==0);
        attachCourseEvents();
    }

    function renderHomework() {
        const names = Object.fromEntries(CONFIG.SUBJECTS.map(s=>[s.id,s.name]));
        const list = queryFilter(homework.filter(h=>!currentSubject || h.subject===currentSubject));
        const grouped = {};
        list.forEach(h=>(grouped[h.subject] ||= []).push(h));
        let html="";
        CONFIG.SUBJECTS.forEach(s=>{
            const items=sortItems(grouped[s.id]||[]);
            html += `<div class="homework-subject"><h3>${s.icon} ${s.name} <span>${items.length}</span></h3><div class="homework-list">`;
            html += items.map(h=>`<div class="homework-card"><div><i class="fa-solid fa-file-pdf pdf-icon"></i><div><strong>${esc(h.title)}</strong><small>${esc(s.name)}</small></div></div>
                <div class="homework-actions"><a class="btn btn-primary btn-sm" href="${esc(h.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-download"></i> تحميل PDF</a>
                ${isAdmin?`<button class="btn btn-danger btn-sm hw-delete" data-id="${h.id}"><i class="fa-solid fa-trash"></i></button>`:""}</div></div>`).join("");
            html += `</div></div>`;
        });
        $("homeworkGrid").innerHTML=html;
        $("homeworkCount").textContent=`${list.length} فروض`;
        $("homeworkEmpty").classList.toggle("hidden", list.length!==0);
        document.querySelectorAll(".hw-delete").forEach(b=>b.onclick=()=>deleteHomework(b.dataset.id));
    }

    function editCourse(id) {
        const c=courses.find(x=>x.id===id); if(!c)return;
        $("courseId").value=id;$("courseSubject").value=c.subject;$("courseTitle").value=c.title;$("courseUrl").value=c.url;
        $("saveCourseBtn").innerHTML='<i class="fa-solid fa-rotate"></i> تحديث الدرس';$("cancelEditBtn").classList.remove("hidden");
        window.scrollTo({top:$("adminSection").offsetTop-80,behavior:"smooth"});
    }
    function resetCourseForm(){ $("courseId").value="";$("courseForm").reset();$("courseSubject").value=currentSubject;$("saveCourseBtn").innerHTML='<i class="fa-solid fa-plus"></i> إضافة الدرس';$("cancelEditBtn").classList.add("hidden");}
    function deleteCourse(id){ if(confirm("هل أنت متأكد من حذف هذا الدرس؟")) coursesRef.child(id).remove(); }
    function deleteHomework(id){ if(confirm("حذف هذا الفرض؟")) homeworkRef.child(id).remove(); }

    $("courseForm").onsubmit=e=>{
        e.preventDefault(); const id=$("courseId").value, data={subject:$("courseSubject").value,title:$("courseTitle").value.trim(),url:$("courseUrl").value.trim(),createdAt:Date.now()};
        if(!getYoutubeId(data.url)) return alert("الرجاء إدخال رابط يوتيوب صحيح!");
        id?coursesRef.child(id).update(data):coursesRef.push(data); resetCourseForm();
    };
    $("homeworkForm").onsubmit=e=>{
        e.preventDefault(); const id=$("homeworkId").value,data={subject:$("homeworkSubject").value,title:$("homeworkTitle").value.trim(),url:$("homeworkUrl").value.trim(),createdAt:Date.now()};
        if(!/\.pdf($|\?)/i.test(data.url)) if(!confirm("الرابط لا ينتهي بـ PDF. هل تريد إضافته رغم ذلك؟")) return;
        id?homeworkRef.child(id).update(data):homeworkRef.push(data);
        $("homeworkForm").reset();$("homeworkId").value="";$("cancelHomeworkBtn").classList.add("hidden");
    };

    function setAdmin(status){isAdmin=status;$("adminBtnText").textContent=status?"خروج الآدمن":"دخول الآدمن";$("adminBtn").classList.toggle("btn-danger",status);$("adminBtn").classList.toggle("btn-outline",!status);showView(currentView);}
    $("adminBtn").onclick=()=>{if(isAdmin)return setAdmin(false);$("authModal").classList.remove("hidden");$("adminPasswordInput").focus();};
    $("loginBtn").onclick=()=>{if($("adminPasswordInput").value===adminPassword()){setAdmin(true);$("authModal").classList.add("hidden");$("adminPasswordInput").value="";}else alert("كلمة المرور غير صحيحة!");};
    $("closeAuthModal").onclick=()=>$("authModal").classList.add("hidden");
    $("cancelEditBtn").onclick=resetCourseForm;
    $("cancelHomeworkBtn").onclick=()=>{$("homeworkForm").reset();$("homeworkId").value="";$("cancelHomeworkBtn").classList.add("hidden");};
    $("closeModal").onclick=()=>{$("videoModal").classList.add("hidden");$("youtubeIframe").src="";};

    tabBtns.forEach(b=>b.onclick=()=>{
        tabBtns.forEach(x=>x.classList.remove("active"));b.classList.add("active");
        if(b.dataset.view==="homework"){currentView="homework";showView("homework");}
        else {currentSubject=b.dataset.subject; $("courseSubject").value=currentSubject;showView("courses");}
    });
    $("favoritesNavBtn").onclick=()=>showView("favorites");
    $("calculatorNavBtn").onclick=()=>showView("calculator");
    $("searchInput").oninput=()=>{if(currentView==="courses")renderCourses();if(currentView==="favorites")renderFavorites();if(currentView==="homework")renderHomework();};
    $("sortSelect").onchange=()=>{if(currentView==="courses")renderCourses();if(currentView==="favorites")renderFavorites();if(currentView==="homework")renderHomework();};
    $("clearSearchBtn").onclick=()=>{$("searchInput").value="";$("sortSelect").value="newest";$("searchInput").dispatchEvent(new Event("input"));};

    function appendCalc(v){calcExpr+=v;$("calcExpression").textContent=calcExpr;$("calcResult").textContent=calcExpr||"0";}
    function factorial(n){if(n<0||n>170||n%1)return NaN;let r=1;for(let i=2;i<=n;i++)r*=i;return r;}
    function calculate(){
        try{
            let e=calcExpr.replace(/Ans/g,`(${lastAnswer})`).replace(/pi/g,"Math.PI").replace(/sqrt/g,"Math.sqrt").replace(/ln/g,"Math.log").replace(/log/g,"Math.log10").replace(/\^/g,"**");
            e=e.replace(/sin\(([^()]*)\)/g,(_,x)=>`Math.sin((${x})${angleMode==="DEG"?`*Math.PI/180`:""})`)
               .replace(/cos\(([^()]*)\)/g,(_,x)=>`Math.cos((${x})${angleMode==="DEG"?`*Math.PI/180`:""})`)
               .replace(/tan\(([^()]*)\)/g,(_,x)=>`Math.tan((${x})${angleMode==="DEG"?`*Math.PI/180`:""})`);
            e=e.replace(/(\d+(?:\.\d+)?)!/g,(_,n)=>`factorial(${n})`);
            if(!/^[0-9+\-*/().,\sA-Za-z_*]+$/.test(e)) throw Error();
            const val=Function("factorial","return "+e)(factorial);
            if(!Number.isFinite(val)) throw Error();
            lastAnswer=val;$("calcResult").textContent=Number(val.toFixed(12));$("calcExpression").textContent=calcExpr+" =";calcExpr=String(Number(val.toFixed(12)));
        }catch{ $("calcResult").textContent="خطأ"; }
    }
    document.querySelectorAll("[data-calc]").forEach(b=>b.onclick=()=>appendCalc(b.dataset.calc));
    document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
        if(b.dataset.action==="clear"){calcExpr="";$("calcExpression").textContent="";$("calcResult").textContent="0";}
        if(b.dataset.action==="back"){calcExpr=calcExpr.slice(0,-1);$("calcExpression").textContent=calcExpr;$("calcResult").textContent=calcExpr||"0";}
        if(b.dataset.action==="equals")calculate();
    });
    $("degBtn").onclick=()=>{angleMode="DEG";$("degBtn").classList.add("mode-active");$("radBtn").classList.remove("mode-active");};
    $("radBtn").onclick=()=>{angleMode="RAD";$("radBtn").classList.add("mode-active");$("degBtn").classList.remove("mode-active");};

    coursesRef.on("value",snap=>{courses=[];const d=snap.val()||{};Object.entries(d).forEach(([id,v])=>courses.push({id,...v}));if(currentView==="courses")renderCourses();if(currentView==="favorites")renderFavorites();});
    homeworkRef.on("value",snap=>{homework=[];const d=snap.val()||{};Object.entries(d).forEach(([id,v])=>homework.push({id,...v}));if(currentView==="homework")renderHomework();});
    showView("courses");
});
