/* =========================================
   AIR PEN WRITING - VERSION 5
   Front + Back Camera
   OpenCV.js + Colored Pen Tip Detection
========================================= */


/* ---------- ELEMENTS ---------- */

const camera =
    document.getElementById("camera");

const processingCanvas =
    document.getElementById("processingCanvas");

const drawingCanvas =
    document.getElementById("drawingCanvas");

const detectedDot =
    document.getElementById("detectedDot");

const cameraMessage =
    document.getElementById("cameraMessage");

const status =
    document.getElementById("status");

const cameraMode =
    document.getElementById("cameraMode");

const startCameraBtn =
    document.getElementById("startCameraBtn");

const switchCameraBtn =
    document.getElementById("switchCameraBtn");

const stopCameraBtn =
    document.getElementById("stopCameraBtn");

const clearBtn =
    document.getElementById("clearBtn");

const saveBtn =
    document.getElementById("saveBtn");


/* ---------- CAMERA ---------- */

let cameraStream = null;

let detectionRunning = false;

let openCVReady = false;

let usingBackCamera = false;


/* ---------- TRACKING ---------- */

let previousX = null;
let previousY = null;

let smoothX = null;
let smoothY = null;


/* ---------- DRAWING ---------- */

let penColor = "black";

let penWidth = 5;


/* ---------- PROCESSING SIZE ---------- */

const PROCESS_WIDTH = 320;
const PROCESS_HEIGHT = 240;


/* ---------- DETECTION SETTINGS ---------- */

/*
   HSV range for bright green/yellow marker.

   Green:
   H ≈ 35-90

   Yellow:
   H ≈ 15-40

   We use a broad range to make detection easier.
*/

const LOWER_H = 15;
const LOWER_S = 80;
const LOWER_V = 80;

const UPPER_H = 95;
const UPPER_S = 255;
const UPPER_V = 255;


/* ---------- AREA ---------- */

const MIN_AREA = 20;

const MAX_AREA = 12000;


/* ---------- SMOOTHING ---------- */

const SMOOTHING = 0.30;


/* =========================================
   OPENCV READY
========================================= */

function onOpenCvReady() {

    openCVReady = true;

    status.textContent =
        "OpenCV ready. Press Start Camera.";

    startCameraBtn.disabled = false;

    clearDrawing();
}


/* =========================================
   DRAWING CANVAS
========================================= */

function resizeDrawingCanvas() {

    const rect =
        drawingCanvas.getBoundingClientRect();

    const oldCanvas =
        document.createElement("canvas");

    oldCanvas.width =
        drawingCanvas.width;

    oldCanvas.height =
        drawingCanvas.height;

    const oldContext =
        oldCanvas.getContext("2d");

    oldContext.drawImage(
        drawingCanvas,
        0,
        0
    );

    drawingCanvas.width =
        Math.max(1, Math.floor(rect.width));

    drawingCanvas.height =
        Math.max(1, Math.floor(rect.height));

    const ctx =
        drawingCanvas.getContext("2d");

    ctx.fillStyle = "white";

    ctx.fillRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );

    if (oldCanvas.width > 0 &&
        oldCanvas.height > 0) {

        ctx.drawImage(
            oldCanvas,
            0,
            0,
            oldCanvas.width,
            oldCanvas.height,
            0,
            0,
            drawingCanvas.width,
            drawingCanvas.height
        );
    }
}


/* =========================================
   CAMERA MODE UI
========================================= */

function updateCameraModeUI() {

    cameraMode.innerHTML =
        "Camera: <strong>" +
        (usingBackCamera ? "Back" : "Front") +
        "</strong>";
}


/* =========================================
   START CAMERA
========================================= */

async function startCamera() {

    if (!openCVReady) {

        status.textContent =
            "Please wait for OpenCV to load.";

        return;
    }

    await startSelectedCamera();
}


/* =========================================
   START SELECTED CAMERA
========================================= */

async function startSelectedCamera() {

    try {

        stopCurrentStream();

        detectionRunning = false;

        resetTracking();

        cameraMessage.style.display =
            "block";

        cameraMessage.textContent =
            "Starting camera...";


        const facingMode =
            usingBackCamera
                ? "environment"
                : "user";


        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: {
                        exact: facingMode
                    },

                    width: {
                        ideal: 640
                    },

                    height: {
                        ideal: 480
                    }
                },

                audio: false
            });


        camera.srcObject =
            cameraStream;


        /* Mirror front camera */

        if (usingBackCamera) {

            camera.style.transform =
                "scaleX(1)";

        } else {

            camera.style.transform =
                "scaleX(-1)";
        }


        updateCameraModeUI();


        cameraMessage.style.display =
            "none";


        startCameraBtn.disabled =
            true;

        switchCameraBtn.disabled =
            false;

        stopCameraBtn.disabled =
            false;


        status.textContent =
            "Camera running. Show the colored pen tip.";


        camera.onloadedmetadata = function () {

            processingCanvas.width =
                camera.videoWidth ||
                PROCESS_WIDTH;

            processingCanvas.height =
                camera.videoHeight ||
                PROCESS_HEIGHT;

            startDetection();
        };


    } catch (error) {

        console.error(error);

        cameraMessage.style.display =
            "block";

        cameraMessage.textContent =
            "Camera could not start.";

        status.textContent =
            "Camera error: " + error.message;


        startCameraBtn.disabled =
            false;

        switchCameraBtn.disabled =
            false;

        stopCameraBtn.disabled =
            true;
    }
}


/* =========================================
   STOP STREAM
========================================= */

function stopCurrentStream() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(track => track.stop());

        cameraStream = null;
    }

    camera.srcObject = null;
}


/* =========================================
   SWITCH CAMERA
========================================= */

async function switchCamera() {

    usingBackCamera =
        !usingBackCamera;

    updateCameraModeUI();

    status.textContent =
        "Switching camera...";

    await startSelectedCamera();
}


/* =========================================
   START DETECTION
========================================= */

function startDetection() {

    if (detectionRunning)
        return;

    detectionRunning = true;

    resetTracking();

    detectPen();
}


/* =========================================
   DETECT PEN TIP
========================================= */

function detectPen() {

    if (!detectionRunning ||
        !cameraStream) {

        return;
    }


    if (camera.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA) {

        requestAnimationFrame(detectPen);

        return;
    }


    const processingContext =
        processingCanvas.getContext("2d", {
            willReadFrequently: true
        });


    processingContext.drawImage(
        camera,
        0,
        0,
        processingCanvas.width,
        processingCanvas.height
    );


    let src = null;
    let resized = null;
    let hsv = null;
    let mask = null;
    let kernel = null;
    let contours = null;
    let hierarchy = null;


    try {

        src =
            cv.imread(processingCanvas);


        resized =
            new cv.Mat();

        cv.resize(
            src,
            resized,
            new cv.Size(
                PROCESS_WIDTH,
                PROCESS_HEIGHT
            )
        );


        /* Convert RGB/RGBA to HSV */

        hsv =
            new cv.Mat();

        cv.cvtColor(
            resized,
            hsv,
            cv.COLOR_RGBA2RGB
        );

        cv.cvtColor(
            hsv,
            hsv,
            cv.COLOR_RGB2HSV
        );


        /* Colored point threshold */

        const lower =
            new cv.Mat(
                hsv.rows,
                hsv.cols,
                hsv.type(),
                [
                    LOWER_H,
                    LOWER_S,
                    LOWER_V,
                    0
                ]
            );

        const upper =
            new cv.Mat(
                hsv.rows,
                hsv.cols,
                hsv.type(),
                [
                    UPPER_H,
                    UPPER_S,
                    UPPER_V,
                    0
                ]
            );


        mask =
            new cv.Mat();

        cv.inRange(
            hsv,
            lower,
            upper,
            mask
        );


        lower.delete();
        upper.delete();


        /* Remove small noise */

        kernel =
            cv.getStructuringElement(
                cv.MORPH_ELLIPSE,
                new cv.Size(5, 5)
            );


        cv.morphologyEx(
            mask,
            mask,
            cv.MORPH_OPEN,
            kernel
        );


        cv.morphologyEx(
            mask,
            mask,
            cv.MORPH_CLOSE,
            kernel
        );


        /* Find colored objects */

        contours =
            new cv.MatVector();

        hierarchy =
            new cv.Mat();


        cv.findContours(
            mask,
            contours,
            hierarchy,
            cv.RETR_EXTERNAL,
            cv.CHAIN_APPROX_SIMPLE
        );


        let bestContour = null;

        let bestScore = 0;


        for (
            let i = 0;
            i < contours.size();
            i++
        ) {

            const contour =
                contours.get(i);


            const area =
                cv.contourArea(contour);


            if (
                area < MIN_AREA ||
                area > MAX_AREA
            ) {

                contour.delete();

                continue;
            }


            const rect =
                cv.boundingRect(contour);


            const width =
                rect.width;

            const height =
                rect.height;


            const centerX =
                rect.x +
                width / 2;

            const centerY =
                rect.y +
                height / 2;


            /*
               Score prefers:

               - reasonable area
               - compact object
               - object near center
            */

            const imageCenterX =
                PROCESS_WIDTH / 2;

            const imageCenterY =
                PROCESS_HEIGHT / 2;


            const distance =
                Math.sqrt(
                    Math.pow(
                        centerX - imageCenterX,
                        2
                    ) +
                    Math.pow(
                        centerY - imageCenterY,
                        2
                    )
                );


            const centerScore =
                1 /
                (1 + distance / 100);


            const score =
                area *
                centerScore;


            if (score > bestScore) {

                if (bestContour)
                    bestContour.delete();

                bestContour =
                    contour;

                bestScore =
                    score;

            } else {

                contour.delete();
            }
        }


        if (bestContour) {

            const moments =
                cv.moments(
                    bestContour
                );


            if (moments.m00 !== 0) {

                let x =
                    moments.m10 /
                    moments.m00;

                let y =
                    moments.m01 /
                    moments.m00;


                /*
                   Smooth position
                */

                if (
                    smoothX === null ||
                    smoothY === null
                ) {

                    smoothX = x;
                    smoothY = y;

                } else {

                    smoothX =
                        smoothX * (1 - SMOOTHING) +
                        x * SMOOTHING;

                    smoothY =
                        smoothY * (1 - SMOOTHING) +
                        y * SMOOTHING;
                }


                x = smoothX;
                y = smoothY;


                /*
                   Convert 320x240
                   back to original camera
                */

                const cameraX =
                    x *
                    processingCanvas.width /
                    PROCESS_WIDTH;


                const cameraY =
                    y *
                    processingCanvas.height /
                    PROCESS_HEIGHT;


                showDetectedPosition(
                    cameraX,
                    cameraY
                );


                drawAirWriting(
                    cameraX,
                    cameraY
                );


                status.textContent =
                    "✍️ Pen tip detected";
            }


            bestContour.delete();


        } else {

            detectedDot.style.display =
                "none";

            resetTracking();

            status.textContent =
                "Searching for colored pen tip...";
        }


    } catch (error) {

        console.error(
            "OpenCV detection error:",
            error
        );

    } finally {

        if (src) src.delete();

        if (resized) resized.delete();

        if (hsv) hsv.delete();

        if (mask) mask.delete();

        if (kernel) kernel.delete();

        if (contours) {

            for (
                let i = 0;
                i < contours.size();
                i++
            ) {

                try {
                    contours.get(i).delete();
                } catch(e) {}
            }

            contours.delete();
        }

        if (hierarchy)
            hierarchy.delete();
    }


    requestAnimationFrame(
        detectPen
    );
}


/* =========================================
   SHOW DETECTED DOT
========================================= */

function showDetectedPosition(
    cameraX,
    cameraY
) {

    const scaleX =
        camera.clientWidth /
        processingCanvas.width;

    const scaleY =
        camera.clientHeight /
        processingCanvas.height;


    let screenX;


    if (usingBackCamera) {

        screenX =
            cameraX * scaleX;

    } else {

        /*
           Front camera is mirrored
        */

        screenX =
            camera.clientWidth -
            cameraX * scaleX;
    }


    const screenY =
        cameraY * scaleY;


    detectedDot.style.left =
        screenX + "px";

    detectedDot.style.top =
        screenY + "px";

    detectedDot.style.display =
        "block";
}


/* =========================================
   AIR WRITING
========================================= */

function drawAirWriting(
    cameraX,
    cameraY
) {

    let normalizedX;

    let normalizedY;


    /*
       Convert camera coordinates
       into normal left-to-right coordinates.
    */

    if (usingBackCamera) {

        normalizedX =
            cameraX /
            processingCanvas.width;

    } else {

        normalizedX =
            1 -
            cameraX /
            processingCanvas.width;
    }


    normalizedY =
        cameraY /
        processingCanvas.height;


    normalizedX =
        Math.max(
            0,
            Math.min(
                1,
                normalizedX
            )
        );


    normalizedY =
        Math.max(
            0,
            Math.min(
                1,
                normalizedY
            )
        );


    const x =
        normalizedX *
        drawingCanvas.width;


    const y =
        normalizedY *
        drawingCanvas.height;


    /*
       First detected point
    */

    if (
        previousX === null ||
        previousY === null
    ) {

        previousX = x;
        previousY = y;

        return;
    }


    const distance =
        Math.sqrt(
            Math.pow(
                x - previousX,
                2
            ) +
            Math.pow(
                y - previousY,
                2
            )
        );


    /*
       Ignore sudden jumps.
    */

    if (distance > 80) {

        previousX = x;
        previousY = y;

        return;
    }


    /*
       Draw line
    */

    const ctx =
        drawingCanvas.getContext("2d");


    ctx.beginPath();

    ctx.moveTo(
        previousX,
        previousY
    );

    ctx.lineTo(
        x,
        y
    );


    ctx.strokeStyle =
        penColor;

    ctx.lineWidth =
        penWidth;

    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";


    ctx.stroke();

    ctx.closePath();


    previousX = x;
    previousY = y;
}


/* =========================================
   RESET TRACKING
========================================= */

function resetTracking() {

    previousX = null;
    previousY = null;

    smoothX = null;
    smoothY = null;
}


/* =========================================
   STOP CAMERA
========================================= */

function stopCamera() {

    detectionRunning = false;

    stopCurrentStream();

    resetTracking();


    detectedDot.style.display =
        "none";


    cameraMessage.style.display =
        "block";

    cameraMessage.textContent =
        "Camera is stopped";


    startCameraBtn.disabled =
        !openCVReady;

    switchCameraBtn.disabled =
        true;

    stopCameraBtn.disabled =
        true;


    status.textContent =
        "Camera stopped.";
}


/* =========================================
   CLEAR DRAWING
========================================= */

function clearDrawing() {

    const ctx =
        drawingCanvas.getContext("2d");


    ctx.fillStyle =
        "white";


    ctx.fillRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );


    resetTracking();
}


/* =========================================
   SAVE DRAWING
========================================= */

function saveDrawing() {

    const link =
        document.createElement("a");


    link.download =
        "air-writing-v5.png";


    link.href =
        drawingCanvas.toDataURL(
            "image/png"
        );


    link.click();
}


/* =========================================
   BUTTON EVENTS
========================================= */

startCameraBtn.addEventListener(
    "click",
    startCamera
);

switchCameraBtn.addEventListener(
    "click",
    switchCamera
);

stopCameraBtn.addEventListener(
    "click",
    stopCamera
);

clearBtn.addEventListener(
    "click",
    clearDrawing
);

saveBtn.addEventListener(
    "click",
    saveDrawing
);


/* =========================================
   WINDOW RESIZE
========================================= */

window.addEventListener(
    "resize",
    resizeDrawingCanvas
);


/* =========================================
   INITIALIZATION
========================================= */

window.addEventListener(
    "load",
    () => {

        resizeDrawingCanvas();

        updateCameraModeUI();

        if (!openCVReady) {

            status.textContent =
                "Loading OpenCV...";
        }
    }
);
