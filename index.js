require('dotenv').config();
const os = require('os');
const io = require('socket.io-client');

const socket = io(process.env.URL || 'http://localhost:3000', {
    auth: { token: process.env.AUTH_TOKEN },
    withCredentials: true,
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log(`socket connected`);
    const nI = os.networkInterfaces();
    let macA;
    for (let key in nI) {
        const isInternetFacing = !nI[key][0].internal;
        if (isInternetFacing) {
            macA = nI[key][0].mac + (process.argv[2] ? process.argv[2] : '');
            break;
        }
    }
    const perfDataInterval = setInterval(async () => {
        const perfData = await performanceLoadData();
        perfData.macA = macA;
        socket.emit('perfData', perfData);
    }, 1000);

    socket.on('disconnect', () => {
        clearInterval(perfDataInterval);
    });
});

const cpuAverage = () => {
    const cpus = os.cpus();
    let idleMs = 0;
    let totalMs = 0;
    cpus.forEach((aCore) => {
        for (mode in aCore.times) {
            totalMs += aCore.times[mode];
        }
        idleMs += aCore.times.idle;
    });
    return {
        idle: idleMs / cpus.length,
        total: totalMs / cpus.length
    };
};

const getCpuLoad = () =>
    new Promise((resolve, reject) => {
        const start = cpuAverage();
        setTimeout(() => {
            const end = cpuAverage();
            const idleDiff = end.idle - start.idle;
            const totalDiff = end.total - start.total;
            const percentOfCpu = 100 - Math.floor((100 * idleDiff) / totalDiff);
            resolve(percentOfCpu);
        }, 100);
    });

const performanceLoadData = async () => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.floor((usedMem / totalMem) * 100) / 100;
    const osType = os.type() === 'Darwin' ? 'Mac' : os.type();
    const upTime = os.uptime();
    const cpuType = cpus[0].model;
    const numCores = cpus.length;
    const cpuSpeed = cpus[0].speed;
    const cpuLoad = await getCpuLoad(cpus);
    return {
        freeMem,
        totalMem,
        usedMem,
        memUsage,
        osType,
        upTime,
        cpuType,
        numCores,
        cpuSpeed,
        cpuLoad
    };
};
