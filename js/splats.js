import { OrbitControls } from "./OrbitControls.js";
import * as SPLAT from "https://cdn.jsdelivr.net/npm/gsplat@latest";
// const bucket = "http://localhost:8000/splats";
// const bucket = "/splats"; // Use relative path for live site
const bucket = "https://storage.googleapis.com/learn_api_splatbucket"; // Use full URL for Google Cloud Storage



function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

async function listFolders() {
    const directories = [
        "bug", "man", "kangaroo", "tokyo"
    ];
    return directories;
}

export function createSplatView(splatParent) {
    const parentDiv = document.getElementById(splatParent);
    const canvas = parentDiv.querySelector("canvas");
    const progressDialog = parentDiv.querySelector("#progress-dialog");
    const progressIndicator = progressDialog.querySelector("#progress-indicator");
    const view = {};
    view.canvas = canvas;
    view.progressDialog = progressDialog;
    view.progressIndicator = progressIndicator;
    view.runningAnimation = null;
    view.loading = false;
    view.lastClick = new Date();
    return view;
}

export async function setSplatScene(name, view) {
    view.loading = true;
    view.lastClick = new Date();

    const startRadius = 2.5;

    const cameraData = new SPLAT.CameraData();
    cameraData.fx = 0.9 * startRadius * view.canvas.offsetWidth;
    cameraData.fy = 0.9 * startRadius * view.canvas.offsetHeight;

    const camera = new SPLAT.Camera(cameraData);
    // camera.position.set(0, 0, 2 * startRadius); // Adjust this value to zoom out further
    // camera.position.set(0, 0, 3 * startRadius); // Adjust this value to zoom out further

    const renderer = new SPLAT.WebGLRenderer(view.canvas);
    const scene = new SPLAT.Scene();

    view.progressDialog.show();
    view.progressIndicator.value = 0.0;

    const splat = await SPLAT.PLYLoader.LoadAsync(`${bucket}/${name}/splat.ply`, scene, (progress) => {
        view.progressIndicator.value = progress * 100;
    });

    // const rotation = new SPLAT.Vector3(Math.PI - Math.PI / 20.0, Math.PI, 0);
    // // const rotation = new SPLAT.Vector3(-Math.PI, -Math.PI, 0);
    // splat.rotation = SPLAT.Quaternion.FromEuler(rotation);
    // splat.applyRotation();

    // const correctiveRotation = new SPLAT.Vector3(Math.PI, 0, 0); // Flip around x-axis
    // splat.rotation = SPLAT.Quaternion.FromEuler(correctiveRotation);
    // splat.applyRotation();


    view.progressDialog.close();

    var controls = new OrbitControls(camera, view.canvas, /*alpha=*/0.0, /*beta=*/0.0, /*radius=*/15, /*enableKeyboardControls=*/false);
    // controls.minAngle = -10;
    // controls.maxAngle = 10;
    // controls.minZoom = 1.5;
    // controls.maxZoom = 3.5;
    // controls.zoomSpeed = 0.03;
    // controls.panSpeed = 0.2;
    // controls.orbitSpeed = 1.75;
    // controls.maxPanDistance = 0.05;
    controls.minAngle = -360;
    controls.maxAngle = 360;
    controls.minZoom = 1.5;
    controls.maxZoom = 35;
    controls.zoomSpeed = 3;
    controls.panSpeed = 0.2;
    controls.orbitSpeed = 1.75;
    controls.maxPanDistance = 0.05;    
    // controls.minAngle = -360;
    // controls.maxAngle = 360;
    // controls.minZoom = 0.8;
    // controls.maxZoom = 0.9;
    // controls.zoomSpeed = 0.03;
    // controls.panSpeed = 0.2;
    // controls.orbitSpeed = 1.75;
    // controls.maxPanDistance = 1000;    

    const newAnimation = view.runningAnimation == null;

    if (newAnimation) {
        view.canvas.addEventListener("mousedown", function () {
            view.lastClick = new Date();
            view.interacting = true;
        });
        view.canvas.addEventListener("mouseup", function () {
            view.lastClick = new Date();
            view.interacting = false;
        });
    }

    let previousTimestamp;
    let previousDeltaTime;
    view.runningAnimation = (timestamp) => {
        var deltaTime = 0.0;
        if (previousTimestamp !== undefined) {
            deltaTime = (timestamp - previousTimestamp) / 1000;
        }
        if (deltaTime > 0.1 && previousDeltaTime !== undefined) {
            deltaTime = previousDeltaTime;
        }
        previousTimestamp = timestamp;
        previousDeltaTime = deltaTime;

        if (!view.interacting) {
            const timeToSpin = 0.5;
            const accelTime = 4.0;
            const maxSpinSpeed = 0.2;

            const timeSinceClick = view.lastClick == undefined ? undefined : (new Date() - view.lastClick) / 1000.0;
            if (timeSinceClick > timeToSpin || timeSinceClick === undefined) {
                const speed = timeSinceClick === undefined ? maxSpinSpeed : Math.min(Math.max(timeSinceClick / accelTime - timeToSpin, 0.0), 1.0) * maxSpinSpeed;
                controls.rotateCameraAngle(speed * deltaTime, 0.0);
            }
        }

        controls.update();

        renderer.render(scene, camera);
        requestAnimationFrame(view.runningAnimation);
    };

    if (newAnimation) {
        requestAnimationFrame(view.runningAnimation);
    }

    view.loading = false;
}

export async function setupCarousel(view, carousel) {
    let files = await listFolders();

    shuffleArray(files);

    const prototype = carousel.querySelector("#splat-carousel-prototype");
    const elements = Object.fromEntries(
        files.map(f => [f, prototype.firstElementChild.cloneNode(true)])
    );

    async function onClickSplatThumb(splatName) {
        if (view.loading) {
            return;
        }
        const elem = elements[splatName];
        if (elem.classList.contains("active")) {
            return;
        }

        const itemsParent = carousel.getElementsByClassName("splat-carousel-items")[0];
        const items = [...itemsParent.getElementsByClassName('splat-carousel-item')];
        let currentIndex = items.indexOf(elem);

        elem.classList.add("loading");

        await setSplatScene(splatName, view);

        Object.values(elements).forEach(e => {
            e.classList.remove("active");
        });
        elem.classList.remove("loading");
        elem.classList.add("active");
    }

    for (let i = 0; i < files.length; ++i) {
        const file = files[i];

        function setup(file) {
            const card = elements[file];
            let startScroll;

            card.addEventListener("mousedown", function () { startScroll = itemsParent.scrollLeft; });
            card.addEventListener("mouseup", function () {
                if (Math.abs(itemsParent.scrollLeft - startScroll) < 10) {
                    onClickSplatThumb(file);
                }
            });

            const img = card.querySelector("img");
            img.src = `${bucket}/${file}/input.png`;

            let isAnimating = false;
            let latestEvent = null;

            card.addEventListener('pointermove', (e) => {
                latestEvent = e;
                if (!isAnimating) {
                    isAnimating = true;
                    requestAnimationFrame(updateCardTransform);
                }
            });

            function updateCardTransform() {
                const e = latestEvent;
                if (e === null || e === undefined) {
                    isAnimating = false;
                    return;
                }
                const cardRect = card.getBoundingClientRect();
                const centerX = cardRect.left + cardRect.width / 2;
                const centerY = cardRect.top + cardRect.height / 2;

                const mouseX = e.clientX - centerX;
                const mouseY = e.clientY - centerY;

                const rotateY = (mouseX / cardRect.width) * 35;
                const rotateX = -(mouseY / cardRect.height) * 35;

                card.style.transform = `translateZ(15px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

                isAnimating = false;
                if (latestEvent !== e) {
                    requestAnimationFrame(updateCardTransform);
                }
            }

            card.addEventListener('mouseleave', () => {
                latestEvent = null;
                card.style.transform = '';
            });
            prototype.parentNode.appendChild(card);
        }

        setup(file);
    }

    prototype.remove();

    const itemsParent = carousel.getElementsByClassName("splat-carousel-items")[0];
    const items = [...itemsParent.getElementsByClassName('splat-carousel-item')];
    let currentIndex = 0;

    function scrollToTarget() {
        items[currentIndex].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    carousel.querySelector('.splat-carousel-button.left').addEventListener('mousedown', () => {
        currentIndex = (currentIndex + items.length - 2) % items.length;
        scrollToTarget();
    });

    carousel.querySelector('.splat-carousel-button.right').addEventListener('mousedown', () => {
        currentIndex = (currentIndex + 2) % items.length;
        scrollToTarget();
    });

    let mouseDown = false;
    let startX, scrollLeft;

    const startDragging = (e) => {
        mouseDown = true;
        startX = e.pageX - itemsParent.offsetLeft;
        scrollLeft = itemsParent.scrollLeft;
    };

    const stopDragging = (e) => {
        e.preventDefault();
        mouseDown = false;
    };

    const move = (e) => {
        e.preventDefault();
        if (!mouseDown) {
            return;
        }
        const x = e.pageX - itemsParent.offsetLeft;
        const scroll = x - startX;
        itemsParent.scrollLeft = scrollLeft - scroll;
    };

    itemsParent.addEventListener('mousemove', move, false);
    itemsParent.addEventListener('mousedown', startDragging, false);
    itemsParent.addEventListener('mouseup', stopDragging, false);
    itemsParent.addEventListener('mouseleave', stopDragging, false);

    onClickSplatThumb(files[0]);
}
