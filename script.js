document.addEventListener("DOMContentLoaded", () => {
    // Initialize Firebase
    if (typeof firebase !== 'undefined' && CONFIG.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
    }

    const db = firebase.database();
    const coursesRef = db.ref("courses");
    const homeworkRef = db.ref("homework");

    // State Variables
    let currentMainTab = "courses";
    let currentSubject = "math";
    let isAdmin = false;
    let courses = [];
    let homeworks = [];
    let favorites = JSON.parse(localStorage.getItem("my_favorites") || "[]");

    // DOM Elements
    const coursesGrid = document.getElementById("coursesGrid");
    const searchInput = document.getElementById("searchInput");
    const itemsCount = document.getElementById("itemsCount");
    const emptyState = document.getElementById("emptyState");
    const currentSectionTitle = document.getElementById("currentSectionTitle");
    const favCount = document.getElementById("favCount");

    // Firebase Realtime Sync
    coursesRef.on("value", snapshot => {
        const data = snapshot.val() || {};
        courses = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        render();
    });

    homeworkRef.on("value", snapshot => {
        const data = snapshot.val() || {};
        homeworks = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        render();
    });

    // Helpers
    function getYoutubeId(url) {
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function updateFavBadge() {
        favCount.textContent = favorites.length;
    }

    function getSubjectName(id) {
        const sub = CONFIG.SUBJECTS.find(s => s.id === id);
        return sub ? sub.name : "";
    }

    // Main & Subject Tabs Logic
    document.querySelectorAll(".main-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".main-tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentMainTab = btn.getAttribute("data-tab");
            
            document.getElementById("subjectsBar").classList.toggle("hidden", currentMainTab === "favorites");
            render();
        });
    });

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentSubject = btn.getAttribute("data-subject");
            render();
        });
    });

    // Search
    searchInput.addEventListener("input", render);

    // Main Render Function
    function render() {
        updateFavBadge();
        coursesGrid.innerHTML = "";
        const query = searchInput.value.toLowerCase().trim();

        let list = [];
        if (currentMainTab === "courses") {
            currentSectionTitle.textContent = `دروس ${getSubjectName(currentSubject)}`;
            list = courses.filter(c => c.subject === currentSubject);
        } else if (currentMainTab === "homework") {
            currentSectionTitle.textContent = `فروض ${getSubjectName(currentSubject)}`;
            list = homeworks.filter(h => h.subject === currentSubject);
        } else if (currentMainTab === "favorites") {
            currentSectionTitle.textContent = "الدروس والفروض المفضلة";
            list = [...courses, ...homeworks].filter(item => favorites.includes(item.id));
        }

        if (query) {
            list = list.filter(item => item.title.toLowerCase().includes(query));
        }

        itemsCount.textContent = `${list.length} عناصر`;

        if (list.length === 0) {
            emptyState.classList.remove("hidden");
            return;
        }
        emptyState.classList.add("hidden");

        list.forEach(item => {
            const isFav = favorites.includes(item.id);
            const card = document.createElement("div");

            if (item.url) { // Course Card
                const videoId = getYoutubeId(item.url);
                card.className = "course-card";
                card.innerHTML = `
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav('${item.id}')">♥</button>
                    <div class="thumb-container" onclick="playVideo('${item.url}', '${item.title}')">
                        <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="thumbnail">
                        <i class="fa-solid fa-circle-play play-icon"></i>
                    </div>
                    <div class="card-body">
                        <h3 class="course-title">${item.title}</h3>
                        ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deleteItem('courses', '${item.id}')">حذف</button>` : ''}
                    </div>
                `;
            } else { // Homework PDF Card
                card.className = "pdf-card";
                card.innerHTML = `
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav('${item.id}')">♥</button>
                    <div class="pdf-icon-box"><i class="fa-solid fa-file-pdf"></i></div>
                    <div class="card-body">
                        <h3 class="course-title">${item.title}</h3>
                        <a href="${item.pdfUrl}" target="_blank" class="btn btn-primary btn-sm"><i class="fa-solid fa-download"></i> تحميل PDF</a>
                        ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deleteItem('homework', '${item.id}')">حذف</button>` : ''}
                    </div>
                `;
            }
            coursesGrid.appendChild(card);
        });
    }

    // Toggle Favorite
    window.toggleFav = function(id) {
        if (favorites.includes(id)) {
            favorites = favorites.filter(fId => fId !== id);
        } else {
            favorites.push(id);
        }
        localStorage.setItem("my_favorites", JSON.stringify(favorites));
        render();
    };

    // Video Modal
    window.playVideo = function(url, title) {
        const videoId = getYoutubeId(url);
        if (videoId) {
            document.getElementById("youtubeIframe").src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            document.getElementById("modalVideoTitle").textContent = title;
            document.getElementById("videoModal").classList.remove("hidden");
        }
    };

    document.getElementById("closeModal").onclick = () => {
        document.getElementById("videoModal").classList.add("hidden");
        document.getElementById("youtubeIframe").src = "";
    };

    // Admin Toggle & Actions
    document.querySelectorAll('input[name="contentType"]').forEach(radio => {
        radio.addEventListener("change", (e) => {
            if (e.target.value === "course") {
                document.getElementById("courseForm").classList.remove("hidden");
                document.getElementById("homeworkForm").classList.add("hidden");
            } else {
                document.getElementById("courseForm").classList.add("hidden");
                document.getElementById("homeworkForm").classList.remove("hidden");
            }
        });
    });

    document.getElementById("courseForm").onsubmit = (e) => {
        e.preventDefault();
        coursesRef.push({
            subject: document.getElementById("courseSubject").value,
            title: document.getElementById("courseTitle").value.trim(),
            url: document.getElementById("courseUrl").value.trim()
        });
        e.target.reset();
    };

    document.getElementById("homeworkForm").onsubmit = (e) => {
        e.preventDefault();
        homeworkRef.push({
            subject: document.getElementById("hwSubject").value,
            title: document.getElementById("hwTitle").value.trim(),
            pdfUrl: document.getElementById("hwPdfUrl").value.trim()
        });
        e.target.reset();
    };

    window.deleteItem = function(type, id) {
        if (confirm("هل تريد حذف هذا العنصر؟")) {
            db.ref(`${type}/${id}`).remove();
        }
    };

    // Admin Auth
    const adminBtn = document.getElementById("adminBtn");
    adminBtn.onclick = () => {
        if (isAdmin) {
            isAdmin = false;
            adminBtn.querySelector("span").textContent = "دخول الآدمن";
            document.getElementById("adminSection").classList.add("hidden");
            render();
        } else {
            document.getElementById("authModal").classList.remove("hidden");
        }
    };

    document.getElementById("loginBtn").onclick = () => {
        if (document.getElementById("adminPasswordInput").value.trim() === CONFIG.ADMIN_PASSWORD) {
            isAdmin = true;
            adminBtn.querySelector("span").textContent = "خروج الآدمن";
            document.getElementById("adminSection").classList.remove("hidden");
            document.getElementById("authModal").classList.add("hidden");
            render();
        } else {
            alert("كلمة المرور خاطئة!");
        }
    };
    document.getElementById("closeAuthModal").onclick = () => document.getElementById("authModal").classList.add("hidden");

    // Widget Toggles
    document.getElementById("aiToggleBtn").onclick = () => document.getElementById("aiWidget").classList.toggle("hidden");
    document.getElementById("closeAiBtn").onclick = () => document.getElementById("aiWidget").classList.add("hidden");

    document.getElementById("calcToggleBtn").onclick = () => document.getElementById("calcWidget").classList.toggle("hidden");
    document.getElementById("closeCalcBtn").onclick = () => document.getElementById("calcWidget").classList.add("hidden");

    // Real Gemini AI Chat Integration (Updated for Header API Auth)
    document.getElementById("sendAiBtn").onclick = sendAiMessage;
    document.getElementById("aiInput").onkeypress = (e) => { if(e.key === 'Enter') sendAiMessage(); };

    async function sendAiMessage() {
        const input = document.getElementById("aiInput");
        const msg = input.value.trim();
        if (!msg) return;

        const box = document.getElementById("aiMessages");
        
        box.innerHTML += `<div class="ai-msg user">${msg}</div>`;
        input.value = "";
        box.scrollTop = box.scrollHeight;

        const loadingId = "loading-" + Date.now();
        box.innerHTML += `<div class="ai-msg bot" id="${loadingId}">جاري التفكير... ⏳</div>`;
        box.scrollTop = box.scrollHeight;

        try {
            const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-goog-api-key": CONFIG.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `أنت معلم ومساعد دراسي متخصص للطلاب. أجِب باختصار ووضوح وبطريقة مبسطة باللغة العربية على هذا السؤال: ${msg}` }]
                    }]
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error("Gemini API Error:", data.error);
                document.getElementById(loadingId).innerText = "خطأ فـ المفتاح: " + data.error.message;
                return;
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أستطع إيجاد إجابة مناسبة.";
            document.getElementById(loadingId).innerText = reply;

        } catch (error) {
            console.error("Fetch Error:", error);
            document.getElementById(loadingId).innerText = "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";
        }

        box.scrollTop = box.scrollHeight;
    }
});

// Scientific Calculator Logic
let calcExpr = "";
function calcNum(n) { calcExpr += n; updateCalc(); }
function calcOp(op) { calcExpr += op; updateCalc(); }
function calcClear() { calcExpr = ""; updateCalc("0"); }
function calcFunc(f) { calcExpr += `Math.${f}(`; updateCalc(); }
function calcEqual() {
    try { updateCalc(eval(calcExpr.replace(/Math.sqrt/g, 'Math.sqrt'))); } 
    catch { updateCalc("خطأ"); calcExpr = ""; }
}
function updateCalc(val) {
    document.getElementById("calcDisplay").value = val !== undefined ? val : calcExpr;
}
