const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- MOCK DATABASE ---
let db = {
    users: [
        { id: "1", name: "Admin User", email: "admin@palmcore.com", password: "password", role: "Admin", token: "jwt-admin-token" },
        { id: "2", name: "Security Guard", email: "guard@palmcore.com", password: "password", role: "Security", token: "jwt-guard-token" },
        { id: "3", name: "Field Supervisor", email: "supervisor@palmcore.com", password: "password", role: "Supervisor", token: "jwt-super-token" }
    ],
    checkpoints: [
        { id: "CP1", name: "Main Entrance Gate", qrCode: "GATE_001", latitude: 5.1234, longitude: 8.5678 },
        { id: "CP2", name: "Block 14 Storage", qrCode: "WH_A_001", latitude: 5.1245, longitude: 8.5689 }
    ],
    blocks: [
        { id: "B1", name: "North Block 01", area: 15.5, treeCount: 2000, plantedDate: "2018-05-10" }
    ],
    assignments: [
        { id: "AS1", blockId: "B1", supervisorId: "3", date: new Date().toISOString(), status: "Pending" }
    ],
    trucks: [
        { id: "T1", plateNumber: "ABC-123", driverName: "Robert Brown", capacity: 10.0 }
    ],
    evacuationPoints: [
        { id: "EV1", blockId: "B1", estimatedQuantity: 5.5, harvestedAt: new Date().toISOString(), latitude: 5.1230, longitude: 8.5670 }
    ]
};

// --- ROUTES ---

// Auth
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email && u.password === password);
    if (user) res.json(user);
    else res.status(401).json({ message: "Invalid credentials" });
});

app.post('/auth/users', (req, res) => {
    db.users.push(req.body);
    res.status(201).json({ message: "User created" });
});

// Security
app.get('/security/checkpoints', (req, res) => res.json(db.checkpoints));
app.post('/security/patrol-logs', (req, res) => res.status(201).json({ message: "Logs received" }));
app.post('/security/incidents', (req, res) => res.status(201).json({ message: "Incident reported" }));

// AgriTech
app.get('/agritech/blocks', (req, res) => res.json(db.blocks));
app.get('/agritech/assignments', (req, res) => res.json(db.assignments));
app.post('/agritech/yield-records', (req, res) => res.status(201).json({ message: "Yield recorded" }));

// Logistics
app.get('/logistics/trucks', (req, res) => res.json(db.trucks));
app.get('/logistics/evacuation-points', (req, res) => res.json(db.evacuationPoints));
app.post('/logistics/records', (req, res) => res.status(201).json({ message: "Logistics record saved" }));

// Health Check
app.get('/', (req, res) => res.send("PalmCore API is Live"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});