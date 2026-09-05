/* =====================================================
   AIR PEN WRITING - VERSION 5
   Corrected Version

   Features:
   - Front camera
   - Back camera
   - Camera switching
   - OpenCV.js
   - Green/yellow pen-tip detection
   - Smooth tracking
   - Air writing
   - Clear
   - Save PNG
===================================================== */


/* =====================================================
   ELEMENTS
===================================================== */

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


/* =====================================================
   VARIABLES
===================================================== */

let cameraStream = null;

let detectionRunning = false;

let openCVReady = false;

let usingBackCamera = false;


/* Tracking */

let previousX = null;
let previousY = null;

let smoothX = null;
let smoothY = null;


/* Drawing */

const penColor = "#000000";

const penWidth = 5;


/* Processing resolution */

const PROCESS_WIDTH = 320;
const PROCESS_HEIGHT = 240;


/* =====================================================
   HSV COLOR RANGE
=====================================================

   This detects bright green through yellow.

   Green:
   approximately H = 35 - 90

   Yellow:
   approximately H = 15 - 40

   Combined range:
   H = 15 - 95
===================================================== */

const LOWER_H = 15;
const LOWER_S = 100;
const LOWER_V = 100;

const UPPER_H = 95;
const UPPER_S = 255;
const UPPER_V = 255;


/* =====================================================
   TRACKING SETTINGS
===================================================== */

const MIN_AREA = 15;
const MAX_AREA = 8000;

const SMOOTHING = 0.35;

const MAX_JUMP = 100;


/* =====================================================
   OPENCV INITIALIZATION
===================================================== */

/*
   OpenCV can load asynchronously.

   We check repeatedly until cv.Mat is available.
*/

function waitForOpenCV() {

    if (
        typeof cv !== "undefined" &&
        cv.Mat
    ) {

        openCVReady = true;

        status.textContent =
            "OpenCV ready. Press Start Camera.";

        startCameraBtn.disabled = false;

        return;
    }


    setTimeout(
        waitForOpenCV,
        100
    );
}


/* Start OpenCV checking */

window.addEventListener(
    "load",
    () => {

        waitForOpenCV();

        setupDrawingCanvas();

        updateCameraModeUI();
    }
);


/* =====================================================
   DRAWING CANVAS SETUP
===================================================== */

function setupDrawingCanvas() {

    const rect =
        drawingCanvas.getBoundingClientRect();


    const width =
        Math.max(
            1,
            Math.floor(rect.width)
        );


    const height =
        Math.max(
            1,
            Math.floor(rect.height)
        );


    drawingCanvas.width =
        width;

    drawingCanvas.height =
        height;


    fillCanvasWhite();
}


/* =====================================================
   WHITE BACKGROUND
===================================================== */

function fillCanvasWhite() {

    const ctx =
        drawingCanvas.getContext("2d");


    ctx.save();

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );

    ctx.restore();
}


/* =====================================================
   CAMERA MODE
===================================================== */

function updateCameraModeUI() {

    cameraMode.innerHTML =
        "Camera: <strong>" +
        (
            usingBackCamera
                ? "Back"
                : "Front"
        ) +
        "</strong>";
}


/* =====================================================
   START CAMERA
===================================================== */

async function startCamera() {

    if (!openCVReady) {

        status.textContent =
            "OpenCV is still loading.";

        return;
    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        status.textContent =
            "Camera API is not supported.";

        return;
    }


    await startSelectedCamera();
}


/* =====================================================
   START SELECTED CAMERA
===================================================== */

async function startSelectedCamera() {

    try {

        stopCurrentStream();

        detectionRunning = false;

        resetTracking();


        cameraMessage.style.display =
            "block";

        cameraMessage.textContent =
            "Starting camera...";


        /*
           IMPORTANT:

           Do NOT use exact here.

           Some Android phones reject
           exact facingMode.
        */

        const facingMode =
            usingBackCamera
                ? "environment"
                : "user";


        const constraints = {

            audio: false,

            video: {

                facingMode: {
                    ideal: facingMode
                },

                width: {
                    ideal: 640
                },

                height: {
                    ideal: 480
                }
            }
        };


        cameraStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );


        camera.srcObject =
            cameraStream;


        /*
           Mirror only front camera.
        */

        if (usingBackCamera) {

            camera.style.transform =
                "scaleX(1)";

        } else {

            camera.style.transform =
                "scaleX(-1)";
        }


        updateCameraModeUI();


        await camera.play();


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


        /*
           Set processing canvas
        */

        if (
            camera.videoWidth > 0 &&
            camera.videoHeight > 0
        ) {

            processingCanvas.width =
                camera.videoWidth;

            processingCanvas.height =
                camera.videoHeight;

        } else {

            processingCanvas.width =
                640;

            processingCanvas.height =
                480;
        }


        startDetection();


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        cameraMessage.style.display =
            "block";

        cameraMessage.textContent =
            "Camera could not start";


        status.textContent =
            "Camera error: " +
            error.message;


        startCameraBtn.disabled =
            false;

        switchCameraBtn.disabled =
            true;

        stopCameraBtn.disabled =
            true;
    }
}


/* =====================================================
   STOP CURRENT STREAM
===================================================== */

function stopCurrentStream() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        cameraStream = null;
    }


    camera.srcObject = null;
}


/* =====================================================
   SWITCH CAMERA
===================================================== */

async function switchCamera() {

    if (!cameraStream) {
        return;
    }


    status.textContent =
        "Switching camera...";


    usingBackCamera =
        !usingBackCamera;


    updateCameraModeUI();


    await startSelectedCamera();
}


/* =====================================================
   START DETECTION
===================================================== */

function startDetection() {

    if (detectionRunning) {
        return;
    }


    detectionRunning = true;

    resetTracking();


    requestAnimationFrame(
        detectPen
    );
}


/* =====================================================
   MAIN DETECTION LOOP
===================================================== */

function detectPen() {

    if (
        !detectionRunning ||
        !cameraStream
    ) {

        return;
    }


    if (
        camera.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
    ) {

        requestAnimationFrame(
            detectPen
        );

        return;
    }


    let src = null;
    let resized = null;
    let rgb = null;
    let hsv = null;
    let mask = null;
    let kernel = null;
    let contours = null;
    let hierarchy = null;


    try {

        /*
           Draw camera frame
           into hidden canvas.
        */

        const context =
            processingCanvas.getContext(
                "2d",
                {
                    willReadFrequently: true
                }
            );


        context.drawImage(
            camera,
            0,
            0,
            processingCanvas.width,
            processingCanvas.height
        );


        /* Read image */

        src =
            cv.imread(
                processingCanvas
            );


        /* Resize */

        resized =
            new cv.Mat();


        cv.resize(
            src,
            resized,
            new cv.Size(
                PROCESS_WIDTH,
                PROCESS_HEIGHT
            ),
            0,
            0,
            cv.INTER_LINEAR
        );


        /* Convert RGBA → RGB */

        rgb =
            new cv.Mat();


        cv.cvtColor(
            resized,
            rgb,
            cv.COLOR_RGBA2RGB
        );


        /* RGB → HSV */

        hsv =
            new cv.Mat();


        cv.cvtColor(
            rgb,
            hsv,
            cv.COLOR_RGB2HSV
        );


        /* HSV limits */

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


        /* Create mask */

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


        /* Remove noise */

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


        /* Find contours */

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

        let bestScore = -Infinity;


        /*
           Find the best colored object.
        */

        for (
            let i = 0;
            i < contours.size();
            i++
        ) {

            const contour =
                contours.get(i);


            const area =
                cv.contourArea(
                    contour
                );


            if (
                area < MIN_AREA ||
                area > MAX_AREA
            ) {

                contour.delete();

                continue;
            }


            const rect =
                cv.boundingRect(
                    contour
                );


            if (
                rect.width < 4 ||
                rect.height < 4
            ) {

                contour.delete();

                continue;
            }


            /*
               Calculate contour center.
            */

            const centerX =
                rect.x +
                rect.width / 2;


            const centerY =
                rect.y +
                rect.height / 2;


            /*
               Prefer objects that are
               reasonably compact.
            */

            const rectArea =
                rect.width *
                rect.height;


            if (rectArea <= 0) {

                contour.delete();

                continue;
            }


            const fillRatio =
                area /
                rectArea;


            /*
               Prefer the object nearest
               the previous position.

               This greatly reduces
               background false detection.
            */

            let trackingScore = 1;


            if (
                smoothX !== null &&
                smoothY !== null
            ) {

                const dx =
                    centerX -
                    smoothX;

                const dy =
                    centerY -
                    smoothY;


                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );


                trackingScore =
                    1 /
                    (
                        1 +
                        distance / 40
                    );
            }


            /*
               Larger area is useful,
               but not too dominant.
            */

            const areaScore =
                Math.sqrt(area);


            const score =
                areaScore *
                fillRatio *
                trackingScore;


            if (
                score > bestScore
            ) {

                if (bestContour) {
                    bestContour.delete();
                }


                bestContour =
                    contour;

                bestScore =
                    score;

            } else {

                contour.delete();
            }
        }


        /*
           Process detected object.
        */

        if (bestContour) {

            const moments =
                cv.moments(
                    bestContour
                );


            if (
                moments.m00 !== 0
            ) {

                let x =
                    moments.m10 /
                    moments.m00;


                let y =
                    moments.m01 /
                    moments.m00;


                /*
                   Smooth movement.
                */

                if (
                    smoothX === null ||
                    smoothY === null
                ) {

                    smoothX = x;
                    smoothY = y;

                } else {

                    smoothX =
                        smoothX *
                        (1 - SMOOTHING) +
                        x *
                        SMOOTHING;


                    smoothY =
                        smoothY *
                        (1 - SMOOTHING) +
                        y *
                        SMOOTHING;
                }


                /*
                   Convert to camera coordinates.
                */

                const cameraX =
                    smoothX *
                    processingCanvas.width /
                    PROCESS_WIDTH;


                const cameraY =
                    smoothY *
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
            "Detection error:",
            error
        );

    } finally {

        /*
           IMPORTANT:
           Free OpenCV memory.
        */

        if (src)
            src.delete();

        if (resized)
            resized.delete();

        if (rgb)
            rgb.delete();

        if (hsv)
            hsv.delete();

        if (mask)
            mask.delete();

        if (kernel)
            kernel.delete();

        if (hierarchy)
            hierarchy.delete();

        if (contours) {

            /*
               Contours that remain in
               the vector need to be released.
            */

            try {
                contours.delete();
            } catch (e) {}
        }
    }


    requestAnimationFrame(
        detectPen
    );
}


/* =====================================================
   SHOW RED DETECTION DOT
===================================================== */

function showDetectedPosition(
    cameraX,
    cameraY
) {

    const displayWidth =
        camera.clientWidth;

    const displayHeight =
        camera.clientHeight;


    const scaleX =
        displayWidth /
        processingCanvas.width;


    const scaleY =
        displayHeight /
        processingCanvas.height;


    let screenX;


    if (usingBackCamera) {

        /*
           Back camera is normal.
        */

        screenX =
            cameraX * scaleX;

    } else {

        /*
           Front camera is mirrored.
        */

        screenX =
            displayWidth -
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


/* =====================================================
   AIR WRITING
===================================================== */

function drawAirWriting(
    cameraX,
    cameraY
) {

    /*
       Convert camera position
       to 0-1 range.
    */

    let normalizedX;


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


    let normalizedY =
        cameraY /
        processingCanvas.height;


    /*
       Keep coordinates inside canvas.
    */

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
  
