// index.html 전용 스크립트: 눈동자 추적 + 매트릭스 머리카락 + 눈 깜빡임
// (얼굴 로고 관련 DOM(#leftEye 등)이 index.html에만 있으므로 이 페이지에서만 로드한다)

document.addEventListener('DOMContentLoaded', () => {
    const leftEye = document.getElementById('leftEye');
    const rightEye = document.getElementById('rightEye');
    const leftHighlight = document.getElementById('leftHighlight');
    const rightHighlight = document.getElementById('rightHighlight');
    if (!leftEye || !rightEye) return;

    // ===== 눈동자 따라가기 효과 =====
    function moveEyes(e) {
        const eyes = [
            { eyeball: leftEye, highlight: leftHighlight, isLeft: true },
            { eyeball: rightEye, highlight: rightHighlight, isLeft: false }
        ];

        eyes.forEach((eye) => {
            const eyeRect = eye.eyeball.parentElement.getBoundingClientRect();
            const eyeCenterX = eyeRect.left + eyeRect.width / 2;
            const eyeCenterY = eyeRect.top + eyeRect.height / 2;

            let deltaX = e.clientX - eyeCenterX;
            let deltaY = e.clientY - eyeCenterY;

            deltaX = deltaX + (eye.isLeft ? 20 : -20);
            deltaX = deltaX * 1.2;
            deltaY = deltaY * 1.4;

            const angle = Math.atan2(deltaY, deltaX);
            const rawDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 12;
            const sensitivity = 0.08;
            const distance = Math.min(maxDistance, rawDistance * sensitivity);

            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;

            eye.eyeball.style.transform = `translate(calc(-60% + ${moveX}px), calc(-50% + ${moveY}px))`;

            let highlightMoveX = moveX + (eye.isLeft ? 2 : -2);
            eye.highlight.style.transform = `translate(${highlightMoveX}px, ${moveY}px)`;
        });
    }

    document.addEventListener('mousemove', moveEyes);

    // ===== 매트릭스 머리카락 효과 - 김춘수 꽃 시 =====
    function createMatrixHair() {
        const matrixHair = document.getElementById('matrixHair');
        if (!matrixHair) return;
        const poemText = '내가그의이름을불러주기전에는그는다만하나의몸짓에지나지않았다내가그의이름을불러주었을때그는나에게로와서꽃이되었다우리들은모두무엇이되고싶다너는나에게로나는너에게로가고싶다하나의의미가되고싶다';
        const chars = poemText.split('');

        function createHairStream() {
            const stream = document.createElement('div');
            stream.className = 'hair-stream';

            const streamType = Math.random();
            if (streamType < 0.1) {
                stream.classList.add('bright');
            } else if (streamType < 0.15) {
                stream.classList.add('special');
            }

            const streamLength = Math.floor(Math.random() * 10) + 15;
            let streamText = '';
            for (let i = 0; i < streamLength; i++) {
                streamText += chars[Math.floor(Math.random() * chars.length)] + '\n';
            }
            stream.textContent = streamText;

            stream.style.left = Math.random() * 100 + '%';
            stream.style.animationDuration = (Math.random() * 3 + 5) + 's';
            stream.style.animationDelay = Math.random() * 2 + 's';

            matrixHair.appendChild(stream);

            setTimeout(() => {
                if (stream.parentNode) stream.remove();
            }, 15000);
        }

        setInterval(createHairStream, 300);
        setInterval(() => {
            for (let i = 0; i < 4; i++) setTimeout(createHairStream, i * 100);
        }, 1500);
        setInterval(() => {
            for (let i = 0; i < 6; i++) setTimeout(createHairStream, i * 50);
        }, 4000);
    }
    createMatrixHair();

    // ===== 눈 깜빡이는 효과 =====
    setInterval(() => {
        [leftEye, rightEye].forEach(eye => {
            const currentTransform = eye.style.transform || 'translate(-60%, -50%)';
            eye.style.transform = currentTransform + ' scaleY(0.1)';
            setTimeout(() => {
                eye.style.transform = currentTransform;
            }, 150);
        });
    }, 1000 + Math.random() * 2000);
});
