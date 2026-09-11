// script.js

document.addEventListener("DOMContentLoaded", () => {
    // === Initialize Firebase ===
    if (typeof firebase !== 'undefined' && CONFIG.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
    } else {
        console.warn("يرجى إدخال معلومات FIREBASE_CONFIG الصحيحة في config.js");
    }

    const db = firebase.database();
    const coursesRef = db.ref("courses");

    // === State Management ===
    let currentSubject = "math";
    let isAdmin = false;
    let courses = [];

    // === DOM Elements ===
    const adminBtn = document.getElementById("adminBtn");
    const adminBtnText = document.getElementById("adminBtnText");
    const adminSection = document.getElementById("adminSection");
    const authModal = document.getElementById("authModal");
    const adminPasswordInput = document.getElementById("adminPasswordInput");
    const loginBtn = document.getElementById("loginBtn");
    const closeAuthModal = document.getElementById("closeAuthModal");

    const courseForm = document.getElementById("courseForm");
    const courseIdInput = document.getElementById("courseId");
    const courseSubjectInput = document.getElementById("courseSubject");
    const courseTitleInput = document.getElementById("courseTitle");
    const courseUrlInput = document.getElementById("courseUrl");
    const saveCourseBtn = document.getElementById("saveCourseBtn");
    const cancelEditBtn = document.getElementById("cancelEditBtn");

    const tabBtns = document.querySelectorAll(".tab-btn");
    const coursesGrid = document.getElementById("coursesGrid");
    const emptyState = document.getElementById("emptyState");
    const currentSubjectTitle = document.getElementById("currentSubjectTitle");
    const coursesCount = document.getElementById("coursesCount");

    const videoModal = document.getElementById("videoModal");
    const closeModal = document.getElementById("closeModal");
    const youtubeIframe = document.getElementById("youtubeIframe");
    const modalVideoTitle = document.getElementById("modalVideoTitle");

    // === Helpers ===
    function getYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function getAdminPassword() {
        return localStorage.getItem("DYNAMIC_ADMIN_PASSWORD") || CONFIG.ADMIN_PASSWORD;
    }

    // === Telegram Bot Sync ===
    async function checkTelegramUpdates() {
        if (!CONFIG.TELEGRAM_BOT_TOKEN || CONFIG.TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN") return;

        try {
            const response = await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getUpdates`);
            const data = await response.json();
            
            if (data.ok && data.result.length > 0) {
                for (let i = data.result.length - 1; i >= 0; i--) {
                    const text = data.result[i].message?.text;
                    if (text && text.startsWith("/setpass ")) {
                        const newPassword = text.split(" ")[1]?.trim();
                        if (newPassword) {
                            localStorage.setItem("DYNAMIC_ADMIN_PASSWORD", newPassword);
                            console.log("تم تحديث كلمة المرور عبر تيليغرام!");
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.error("خطأ أثناء الربط مع Telegram:", error);
        }
    }

    // === Fetch Data from Firebase (Realtime Sync) ===
    function listenToCourses() {
        coursesRef.on("value", (snapshot) => {
            const data = snapshot.val();
            courses = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    courses.push({ id: key, ...data[key] });
                });
            }
            renderCourses();
        });
    }

    // === Render Logic ===
    function renderCourses() {
        const filteredCourses = courses.filter(c => c.subject === currentSubject);
        
        const subjectObj = CONFIG.SUBJECTS.find(s => s.id === currentSubject);
        currentSubjectTitle.textContent = `دروس ${subjectObj ? subjectObj.name : ""}`;
        coursesCount.textContent = `${filteredCourses.length} دروس`;

        coursesGrid.innerHTML = "";

        if (filteredCourses.length === 0) {
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");

        filteredCourses.forEach(course => {
            const videoId = getYoutubeId(course.url);
            const thumbnailUrl = videoId 
                ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` 
                : 'https://via.placeholder.com/480x360?text=No+Thumbnail';

            const card = document.createElement("div");
            card.className = "course-card";
            card.innerHTML = `
                <div class="thumb-container" data-url="${course.url}" data-title="${course.title}">
                    <img src="${thumbnailUrl}" alt="${course.title}" loading="lazy">
                    <i class="fa-solid fa-circle-play play-icon"></i>
                </div>
                <div class="card-body">
                    <h3 class="course-title">${course.title}</h3>
                    ${isAdmin ? `
                        <div class="card-actions">
                            <button class="btn btn-secondary btn-sm edit-btn" data-id="${course.id}">
                                <i class="fa-solid fa-pen"></i> تعديل
                            </button>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${course.id}">
                                <i class="fa-solid fa-trash"></i> حذف
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;

            coursesGrid.appendChild(card);
        });

        attachCardEvents();
    }

    function attachCardEvents() {
        document.querySelectorAll(".thumb-container").forEach(container => {
            container.addEventListener("click", () => {
                const url = container.getAttribute("data-url");
                const title = container.getAttribute("data-title");
                const videoId = getYoutubeId(url);

                if (videoId) {
                    youtubeIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                    modalVideoTitle.textContent = title;
                    videoModal.classList.remove("hidden");
                } else {
                    alert("رابط الفيديو غير صالح!");
                }
            });
        });

        if (isAdmin) {
            document.querySelectorAll(".edit-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = e.currentTarget.getAttribute("data-id");
                    editCourse(id);
                });
            });

            document.querySelectorAll(".delete-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = e.currentTarget.getAttribute("data-id");
                    deleteCourse(id);
                });
            });
        }
    }

    // === Admin Actions ===
    function toggleAdminMode(status) {
        isAdmin = status;
        if (isAdmin) {
            adminBtnText.textContent = "خروج الآدمن";
            adminSection.classList.remove("hidden");
            adminBtn.classList.replace("btn-outline", "btn-danger");
        } else {
            adminBtnText.textContent = "دخول الآدمن";
            adminSection.classList.add("hidden");
            adminBtn.classList.replace("btn-danger", "btn-outline");
            resetForm();
        }
        renderCourses();
    }

    function editCourse(id) {
        const course = courses.find(c => c.id === id);
        if (!course) return;

        courseIdInput.value = course.id;
        courseSubjectInput.value = course.subject;
        courseTitleInput.value = course.title;
        courseUrlInput.value = course.url;

        saveCourseBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> تحديث الدرس`;
        cancelEditBtn.classList.remove("hidden");

        window.scrollTo({ top: adminSection.offsetTop - 80, behavior: 'smooth' });
    }

    function deleteCourse(id) {
        if (confirm("هل أنت تأكد من رغبتك في حذف هذا الدرس؟")) {
            coursesRef.child(id).remove();
        }
    }

    function resetForm() {
        courseIdInput.value = "";
        courseForm.reset();
        courseSubjectInput.value = currentSubject;
        saveCourseBtn.innerHTML = `<i class="fa-solid fa-plus"></i> إضافة الدرس`;
        cancelEditBtn.classList.add("hidden");
    }

    // === Event Listeners ===
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentSubject = btn.getAttribute("data-subject");
            courseSubjectInput.value = currentSubject;
            renderCourses();
        });
    });

    adminBtn.addEventListener("click", () => {
        if (isAdmin) {
            toggleAdminMode(false);
        } else {
            authModal.classList.remove("hidden");
            adminPasswordInput.focus();
        }
    });

    closeAuthModal.addEventListener("click", () => authModal.classList.add("hidden"));

    loginBtn.addEventListener("click", () => {
        const password = adminPasswordInput.value.trim();
        if (password === getAdminPassword()) {
            toggleAdminMode(true);
            authModal.classList.add("hidden");
            adminPasswordInput.value = "";
        } else {
            alert("كلمة المرور غير صحيحة!");
        }
    });

    courseForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const id = courseIdInput.value;
        const subject = courseSubjectInput.value;
        const title = courseTitleInput.value.trim();
        const url = courseUrlInput.value.trim();

        if (!getYoutubeId(url)) {
            alert("الرجاء إدخال رابط يوتيوب صحيح!");
            return;
        }

        const courseData = { subject, title, url };

        if (id) {
            coursesRef.child(id).update(courseData);
        } else {
            coursesRef.push(courseData);
        }

        resetForm();
    });

    cancelEditBtn.addEventListener("click", resetForm);

    closeModal.addEventListener("click", () => {
        videoModal.classList.add("hidden");
        youtubeIframe.src = "";
    });

    // === Init ===
    checkTelegramUpdates();
    listenToCourses();
});
