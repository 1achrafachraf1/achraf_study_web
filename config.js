// config.js

const CONFIG = {
    // كلمة المرور الافتراضية للآدمن
    ADMIN_PASSWORD: "admin123",
    
    // إعدادات بوت تيليغرام (ضع التوكن الخاص بـ BotFather هنا)
    TELEGRAM_BOT_TOKEN: "8936538670:AAFD9cVQkGiYTncQVIPvZQnuMugOqsgqfZQ",

    // إعدادات Firebase الخاصة بمشروعك (مكتملة ومضبوطة)
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyBdu7sGFwPEGFa_nMol7oiTveg4iltUTL0",
        authDomain: "study-platform-7ed7e.firebaseapp.com",
        databaseURL: "https://study-platform-7ed7e-default-rtdb.firebaseio.com",
        projectId: "study-platform-7ed7e",
        storageBucket: "study-platform-7ed7e.firebasestorage.app",
        messagingSenderId: "847835949714",
        appId: "1:847835949714:web:7599aff06d85972b90544b"
    },

    // المواد المتاحة فالموقع
    HOMEWORK_PATH: "homework",

    SUBJECTS: [
        { id: "math", name: "الرياضيات", icon: "📐" },
        { id: "physics", name: "الفيزياء والكيمياء", icon: "🧪" },
        { id: "svt", name: "علوم الحياة والأرض", icon: "🧬" }
    ]
};
