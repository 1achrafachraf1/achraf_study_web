// تهيئة Firebase ببيانات الربط الموجودة فـ config.js
firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
const database = firebase.database();

// 1. التنقل بين الصفحات
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// 2. حساب معدل الأولى بكالوريا
function calculateGPA() {
    const regional = parseFloat(document.getElementById('regional').value);
    const s1 = parseFloat(document.getElementById('s1').value);
    const s2 = parseFloat(document.getElementById('s2').value);
    const resultDiv = document.getElementById('gpa-result');

    if (isNaN(regional) || isNaN(s1) || isNaN(s2)) {
        resultDiv.innerHTML = "<span style='color:red;'>يرجى إدخال جميع النقاط بشكل صحيح!</span>";
        return;
    }

    const cc = (s1 + s2) / 2;
    const finalGPA = (regional * 0.5) + (cc * 0.5);

    let status = finalGPA >= 10 ? "<span style='color:green;'>مستوفى (ناجح)</span>" : "<span style='color:red;'>غير مستوفى</span>";

    resultDiv.innerHTML = `المعدل العام: <strong>${finalGPA.toFixed(2)}</strong> / 20 <br> النتيجة: ${status}`;
}

// 3. الحاسبة العلمية
const display = document.getElementById('calc-display');

function calcAppend(val) {
    if (display.value === '0') display.value = '';
    display.value += val;
}

function calcClear() {
    display.value = '';
}

function calcBack() {
    display.value = display.value.slice(0, -1);
}

function calcEquals() {
    try {
        display.value = eval(display.value);
    } catch (e) {
        display.value = 'خطأ';
    }
}

function calcMath(func) {
    try {
        let val = parseFloat(display.value);
        if (isNaN(val)) return;
        
        if (func === 'sin') display.value = Math.sin(val * Math.PI / 180).toFixed(4);
        if (func === 'cos') display.value = Math.cos(val * Math.PI / 180).toFixed(4);
        if (func === 'tan') display.value = Math.tan(val * Math.PI / 180).toFixed(4);
        if (func === 'sqrt') display.value = Math.sqrt(val).toFixed(4);
    } catch (e) {
        display.value = 'خطأ';
    }
}

// 4. إدارة المهام (مربوطة مع Firebase Realtime Database)
const tasksRef = database.ref('tasks');

function addTask() {
    const input = document.getElementById('task-text');
    const text = input.value.trim();
    if (!text) return;

    // حفظ المهمة فـ Firebase
    tasksRef.push({
        text: text,
        completed: false
    });

    input.value = '';
}

// القراءة المباشرة للمهام من Firebase
tasksRef.on('value', (snapshot) => {
    const ul = document.getElementById('task-list');
    ul.innerHTML = '';
    
    snapshot.forEach((childSnapshot) => {
        const taskId = childSnapshot.key;
        const task = childSnapshot.val();

        const li = document.createElement('li');
        if (task.completed) li.classList.add('completed');
        
        li.innerHTML = `
            <span>${task.text}</span>
            <div class="task-actions">
                <button onclick="toggleTask('${taskId}', ${task.completed})" style="color:green;"><i class="fa-solid fa-check"></i></button>
                <button onclick="deleteTask('${taskId}')" style="color:red;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        ul.appendChild(li);
    });
});

function toggleTask(id, currentStatus) {
    database.ref('tasks/' + id).update({
        completed: !currentStatus
    });
}

function deleteTask(id) {
    database.ref('tasks/' + id).remove();
}

// 5. المترجم البسيط
const dictionary = {
    "دالة": "Fonction",
    "fonction": "دالة",
    "اشتقاق": "Dérivation",
    "dérivation": "اشتقاق",
    "متتالية": "Suite",
    "suite": "متتالية",
    "تكامل": "Intégrale",
    "intégrale": "تكامل",
    "سرعة": "Vitesse",
    "vitesse": "سرعة",
    "تسارع": "Accélération",
    "accélération": "تسارع"
};

function translateText() {
    const query = document.getElementById('trans-input').value.trim().toLowerCase();
    const resultDiv = document.getElementById('trans-result');

    if (!query) {
        resultDiv.innerText = "النتيجة ستظهر هنا...";
        return;
    }

    if (dictionary[query]) {
        resultDiv.innerHTML = `الترجمة: <strong>${dictionary[query]}</strong>`;
    } else {
        resultDiv.innerText = "لم يتم العثور على مصطلح مطابق فالمعجم.";
    }
}
