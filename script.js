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
    function reverseStr(s="") { return String(s).split("").reverse().join(""); }
    function adminPassword() {
        const dynamic = localStorage.getItem("DYNAMIC_ADMIN_PASSWORD");
        if (dynamic) return dynamic;
        return reverseStr(CONFIG.ADMIN_PASSWORD_ENCODED || "");
    }

    function showView(view) {
        currentView = view;
        $("coursesView").classList.toggle("hidden", view !== "courses");
        $("homeworkView").classList.toggle("hidden", view !== "homework");
        $("favoritesView").classList.toggle("hidden", view !== "favorites");
        $("calculatorView").classList.toggle("hidden", view !== "calculator");
        $("graphView").classList.toggle("hidden", view !== "graph");
        $("searchSection").classList.toggle("hidden", view === "calculator" || view === "graph");
        $("adminSection").classList.toggle("hidden", !isAdmin || view !== "courses");
        $("homeworkAdminSection").classList.toggle("hidden", !isAdmin || view !== "homework");
        if (view === "courses") renderCourses();
        if (view === "homework") renderHomework();
        if (view === "favorites") renderFavorites();
        if (view === "graph") setTimeout(plotGraph, 0);
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
    $("graphNavBtn").onclick=()=>showView("graph");
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

    /* ===== Function Graph Plotter ===== */
    function sanitizeFxExpr(exprRaw){
        let e = exprRaw.replace(/\s+/g,"")
            .replace(/\^/g,"**")
            .replace(/pi/g,"Math.PI")
            .replace(/sqrt/g,"Math.sqrt")
            .replace(/abs\(/g,"Math.abs(")
            .replace(/ln\(/g,"Math.log(")
            .replace(/log\(/g,"Math.log10(")
            .replace(/sin\(/g,"Math.sin(")
            .replace(/cos\(/g,"Math.cos(")
            .replace(/tan\(/g,"Math.tan(");
        e = e.replace(/(\d)(x)/g,"$1*$2").replace(/(\d)(\()/g,"$1*$2").replace(/(x)(\()/g,"$1*$2");
        if(!/^[0-9x+\-*/().,A-Za-z_]+$/.test(e)) throw new Error("invalid expression");
        return e;
    }
    function niceStep(rough){
        const pow=Math.pow(10, Math.floor(Math.log10(Math.abs(rough)||1)));
        const n=rough/pow;
        const step = n<1.5?1:n<3?2:n<7?5:10;
        return step*pow;
    }
    function round2(n){ return Math.abs(n)<0.005 ? "0" : Number(n.toFixed(2)).toString(); }

    function plotGraph(){
        const canvas=$("graphCanvas"), errorEl=$("graphError");
        if(!canvas) return;
        errorEl.classList.add("hidden");
        const exprRaw=$("graphFunctionInput").value.trim()||"x";
        let xMin=parseFloat($("graphXMin").value), xMax=parseFloat($("graphXMax").value);
        if(!Number.isFinite(xMin)||!Number.isFinite(xMax)||xMin>=xMax){xMin=-10;xMax=10;}

        const rect=canvas.getBoundingClientRect();
        const dpr=window.devicePixelRatio||1;
        canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
        const ctx=canvas.getContext("2d");
        ctx.setTransform(dpr,0,0,dpr,0,0);
        const W=rect.width, H=rect.height;
        ctx.clearRect(0,0,W,H);

        let compiled;
        try{
            const expr=sanitizeFxExpr(exprRaw);
            compiled=new Function("x","return "+expr+";");
            compiled(1);
        }catch(err){
            errorEl.textContent="⚠️ الدالة المدخلة غير صحيحة. تحقق من الصيغة.";
            errorEl.classList.remove("hidden");
            return;
        }

        const N=400, points=[];
        let yMin=Infinity, yMax=-Infinity;
        for(let i=0;i<=N;i++){
            const x=xMin+(xMax-xMin)*i/N;
            let y; try{ y=compiled(x); }catch{ y=NaN; }
            if(Number.isFinite(y)){ points.push([x,y]); if(y<yMin)yMin=y; if(y>yMax)yMax=y; }
            else points.push([x,null]);
        }
        if(!Number.isFinite(yMin)||!Number.isFinite(yMax)){
            errorEl.textContent="⚠️ ماكاينش قيم صالحة لهاد الدالة فهاد المجال.";
            errorEl.classList.remove("hidden");
            return;
        }
        if(yMin===yMax){yMin-=1;yMax+=1;}
        const yPad=(yMax-yMin)*0.1||1; yMin-=yPad; yMax+=yPad;

        const padding=30, plotW=W-padding*2, plotH=H-padding*2;
        const xToPx=x=>padding+(x-xMin)/(xMax-xMin)*plotW;
        const yToPx=y=>padding+(1-(y-yMin)/(yMax-yMin))*plotH;

        ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=1; ctx.font="11px system-ui"; ctx.fillStyle="#64748b";
        const xStep=niceStep((xMax-xMin)/8), yStep=niceStep((yMax-yMin)/8);
        for(let gx=Math.ceil(xMin/xStep)*xStep; gx<=xMax; gx+=xStep){
            const px=xToPx(gx);
            ctx.beginPath(); ctx.moveTo(px,padding); ctx.lineTo(px,H-padding); ctx.stroke();
            ctx.fillText(round2(gx), px-8, H-padding+14);
        }
        for(let gy=Math.ceil(yMin/yStep)*yStep; gy<=yMax; gy+=yStep){
            const py=yToPx(gy);
            ctx.beginPath(); ctx.moveTo(padding,py); ctx.lineTo(W-padding,py); ctx.stroke();
            ctx.fillText(round2(gy), 4, py+4);
        }
        ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.5;
        if(xMin<=0&&xMax>=0){ const px=xToPx(0); ctx.beginPath(); ctx.moveTo(px,padding); ctx.lineTo(px,H-padding); ctx.stroke(); }
        if(yMin<=0&&yMax>=0){ const py=yToPx(0); ctx.beginPath(); ctx.moveTo(padding,py); ctx.lineTo(W-padding,py); ctx.stroke(); }

        ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim()||"#3b82f6";
        ctx.lineWidth=2.5; ctx.beginPath();
        let started=false;
        points.forEach(([x,y])=>{
            if(y===null){ started=false; return; }
            const px=xToPx(x), py=yToPx(y);
            if(!started){ ctx.moveTo(px,py); started=true; } else ctx.lineTo(px,py);
        });
        ctx.stroke();
    }
    $("graphDrawBtn").onclick=plotGraph;
    $("graphFunctionInput").onkeydown=e=>{ if(e.key==="Enter") plotGraph(); };
    $("graphXMin").onchange=plotGraph;
    $("graphXMax").onchange=plotGraph;
    document.querySelectorAll(".graph-grid button").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            const gInput=$("graphFunctionInput");
            const action=btn.dataset.gAction;
            if(action==="clear"){ gInput.value=""; gInput.focus(); plotGraph(); return; }
            if(action==="back"){
                const pos=gInput.selectionStart ?? gInput.value.length;
                if(pos>0){
                    gInput.value = gInput.value.slice(0,pos-1) + gInput.value.slice(pos);
                    gInput.focus(); gInput.setSelectionRange(pos-1,pos-1);
                }
                plotGraph();
                return;
            }
            const token=btn.dataset.g;
            if(token===undefined) return;
            const start=gInput.selectionStart ?? gInput.value.length;
            const end=gInput.selectionEnd ?? gInput.value.length;
            gInput.value = gInput.value.slice(0,start) + token + gInput.value.slice(end);
            const newPos=start+token.length;
            gInput.focus(); gInput.setSelectionRange(newPos,newPos);
            plotGraph();
        });
    });
    window.addEventListener("resize", ()=>{ if(currentView==="graph") plotGraph(); });

    coursesRef.on("value",snap=>{courses=[];const d=snap.val()||{};Object.entries(d).forEach(([id,v])=>courses.push({id,...v}));if(currentView==="courses")renderCourses();if(currentView==="favorites")renderFavorites();});
    homeworkRef.on("value",snap=>{homework=[];const d=snap.val()||{};Object.entries(d).forEach(([id,v])=>homework.push({id,...v}));if(currentView==="homework")renderHomework();});
    showView("courses");

    /* ===== AI Chat Widget (Gemini) ===== */
    (function initAIChat(){
        const toggle=$("aiChatToggle"), win=$("aiChatWindow"), closeBtn=$("aiChatClose");
        const messagesEl=$("aiChatMessages"), input=$("aiChatInput"), sendBtn=$("aiChatSend");
        let history=[]; // {role:"user"|"model", text}
        let sending=false;

        function cleanFormatting(text){
            return text
                .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
                .replace(/\*\*(.*?)\*\*/g, "$1")
                .replace(/\*(.*?)\*/g, "$1")
                .replace(/^#{1,6}\s*/gm, "")
                .replace(/^[•\-]\s*/gm, "- ")
                .replace(/`{1,3}/g, "")
                .trim();
        }

        function addBubble(text, who){
            const div=document.createElement("div");
            div.className="ai-msg "+(who==="user"?"ai-msg-user":"ai-msg-bot");
            div.textContent=who==="bot" ? cleanFormatting(text) : text;
            messagesEl.appendChild(div);
            messagesEl.scrollTop=messagesEl.scrollHeight;
            return div;
        }

        async function askGroq(userText){
            const apiKey=CONFIG.GROQ_API_KEY;
            const model=CONFIG.GROQ_MODEL || "llama-3.3-70b-versatile";
            if(!apiKey || apiKey.includes("ضع_مفتاح")){
                addBubble("⚠️ لم يتم ضبط مفتاح Groq API بعد. أضفه في config.js (GROQ_API_KEY).","bot");
                return;
            }
            const typingEl=addBubble("...جاري الكتابة","bot");
            typingEl.classList.add("ai-msg-typing");

            const messages=[
                {role:"system", content:"أنت مساعد تعليمي فمنصة دراسية مغربية لتلاميذ الأولى باكالوريا (رياضيات، فيزياء وكيمياء، علوم الحياة والأرض). جاوب بالدارجة المغربية أو العربية الفصحى. قواعد مهمة: 1) جاوب بإيجاز شديد، بجملتين إلى أربع جمل كحد أقصى إلا إذا طلب التلميذ شرح مفصل. 2) ممنوع استعمال أي رموز تنسيق مثل ** أو # أو backticks أو LaTeX (\\[ \\] \\( \\)). 3) اكتب الرياضيات بنص عادي بسيط: مثلا x^2 للأس، sqrt(x) للجذر، f(x) = 2x + 1 للدوال. 4) إلا كان السؤال يحتاج خطوات، رقمهم بأرقام عادية (1- 2- 3-) بلا نجوم."},
                ...history.map(h=>({role:h.role, content:h.text})),
                {role:"user", content:userText}
            ];

            try{
                const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
                    method:"POST",
                    headers:{
                        "Content-Type":"application/json",
                        "Authorization":"Bearer "+apiKey
                    },
                    body:JSON.stringify({
                        model,
                        messages,
                        temperature:0.5,
                        max_tokens:300
                    })
                });
                const data=await res.json();
                typingEl.remove();
                if(!res.ok){
                    addBubble("⚠️ وقع خطأ فالاتصال بـ Groq: "+(data?.error?.message||res.status),"bot");
                    return;
                }
                const reply=data?.choices?.[0]?.message?.content?.trim() || "ما قدرتش نجاوب دابا، عاود المحاولة.";
                addBubble(reply,"bot");
                history.push({role:"user", text:userText});
                history.push({role:"assistant", text:reply});
                if(history.length>20) history=history.slice(-20);
            }catch(err){
                typingEl.remove();
                addBubble("⚠️ ماكاينش اتصال بالخدمة دابا، جرب مرة أخرى.","bot");
            }
        }

        async function handleSend(){
            const text=input.value.trim();
            if(!text||sending) return;
            sending=true; sendBtn.disabled=true;
            addBubble(text,"user");
            input.value="";
            await askGroq(text);
            sending=false; sendBtn.disabled=false; input.focus();
        }

        toggle.onclick=()=>{win.classList.toggle("hidden"); if(!win.classList.contains("hidden")) input.focus();};
        closeBtn.onclick=()=>win.classList.add("hidden");
        sendBtn.onclick=handleSend;
        input.onkeydown=e=>{if(e.key==="Enter") handleSend();};
    })();
});
