// ============================================
// AIR PEN WRITING
// OPENCV.JS PEN-TIP TRACKING
// ============================================


// ============================================
// HTML ELEMENTS
// ============================================

const camera =
    document.getElementById("camera");


const processingCanvas =
    document.getElementById(
        "processingCanvas"
    );


const processingContext =
    processingCanvas.getContext(
        "2d",
        {
            willReadFrequently: true
        }
    );


const drawingCanvas =
    document.getElementById(
        "drawingCanvas"
    );


const drawingContext =
    drawingCanvas.getContext(
        "2d"
    );


const detectedDot =
    document.getElementById(
        "detectedDot"
    );


const cameraMessage =
    document.getElementById(
        "cameraMessage"
    );


const statusText =
    document.getElementById(
        "status"
    );


const startCameraBtn =
    document.getElementById(
        "startCameraBtn"
    );


const stopCameraBtn =
    document.getElementById(
        "stopCameraBtn"
    );


const clearBtn =
    document.getElementById(
        "clearBtn"
    );


const saveBtn =
    document.getElementById(
        "saveBtn"
    );


// ============================================
// VARIABLES
// ============================================

let cameraStream = null;

let detectionRunning = false;

let openCVReady = false;


// Previous position

let previousX = null;

let previousY = null;


// Smoothed position

let smoothX = null;

let smoothY = null;


// Drawing settings

let penColor = "black";

let penWidth = 5;


// ============================================
// COLOR DETECTION SETTINGS
// ============================================
//
// We detect a bright GREEN marker.
//
// HSV ranges:
//
// H = hue
// S = saturation
// V = brightness
//
// ============================================

const LOWER_H =
    35;

const LOWER_S =
    80;

const LOWER_V =
    80;


const UPPER_H =
    90;

const UPPER_S =
    255;

const UPPER_V =
    255;


// ============================================
// OPENCV READY
// ============================================

function onOpenCvReady() {

    openCVReady =
        true;


    statusText.innerText =
        "OpenCV loaded. Ready to start camera.";


    startCameraBtn.disabled =
        false;

}


window.onOpenCvReady =
    onOpenCvReady;


// ============================================
// DRAWING CANVAS
// ============================================

function resizeCanvas() {

    const rect =
        drawingCanvas
            .getBoundingClientRect();


    drawingCanvas.width =
        rect.width;


    drawingCanvas.height =
        rect.height;


    drawingContext.fillStyle =
        "white";


    drawingContext.fillRect(

        0,

        0,

        drawingCanvas.width,

        drawingCanvas.height

    );

}


window.addEventListener(
    "load",
    resizeCanvas
);


// ============================================
// START CAMERA
// ============================================

async function startCamera() {

    if (!openCVReady) {

        alert(
            "Please wait for OpenCV to load."
        );

        return;

    }


    try {

        statusText.innerText =
            "Starting camera...";


        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {
                            ideal:
                                "environment"
                        },

                        width: {
                            ideal:
                                640
                        },

                        height: {
                            ideal:
                                480
                        }

                    },

                    audio: false

                });


        camera.srcObject =
            cameraStream;


        cameraMessage.style.display =
            "none";


        startCameraBtn.disabled =
            true;


        stopCameraBtn.disabled =
            false;


        camera.onloadedmetadata =
            function () {

                processingCanvas.width =
                    camera.videoWidth;


                processingCanvas.height =
                    camera.videoHeight;


                startDetection();

            };


    }

    catch (error) {

        console.error(error);


        statusText.innerText =
            "Camera error";


        alert(
            "Camera could not start.\n\n" +
            "Allow camera permission and try again."
        );

    }

}


// ============================================
// START DETECTION
// ============================================

function startDetection() {

    detectionRunning =
        true;


    previousX =
        null;


    previousY =
        null;


    smoothX =
        null;


    smoothY =
        null;


    detectPen();

}


// ============================================
// PEN DETECTION
// ============================================

function detectPen() {

    if (!detectionRunning) {

        return;

    }


    // ========================================
    // COPY VIDEO FRAME
    // ========================================

    processingContext.drawImage(

        camera,

        0,

        0,

        processingCanvas.width,

        processingCanvas.height

    );


    // ========================================
    // READ WITH OPENCV
    // ========================================

    let src =
        cv.imread(
            processingCanvas
        );


    // ========================================
    // RESIZE
    // ========================================

    let small =
        new cv.Mat();


    cv.resize(

        src,

        small,

        new cv.Size(
            320,
            240
        )

    );


    // ========================================
    // RGBA → HSV
    // ========================================

    let hsv =
        new cv.Mat();


    cv.cvtColor(

        small,

        hsv,

        cv.COLOR_RGBA2HSV

    );


    // ========================================
    // GREEN MASK
    // ========================================

    let lower =
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


    let upper =
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


    let mask =
        new cv.Mat();


    cv.inRange(

        hsv,

        lower,

        upper,

        mask

    );


    // ========================================
    // REMOVE NOISE
    // ========================================

    let kernel =
        cv.Mat.ones(
            5,
            5,
            cv.CV_8U
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


    // ========================================
    // FIND CONTOURS
    // ========================================

    let contours =
        new cv.MatVector();


    let hierarchy =
        new cv.Mat();


    cv.findContours(

        mask,

        contours,

        hierarchy,

        cv.RETR_EXTERNAL,

        cv.CHAIN_APPROX_SIMPLE

    );


    let bestContour =
        null;


    let bestArea =
        0;


    // ========================================
    // FIND LARGEST GREEN OBJECT
    // ========================================

    for (
        let i = 0;
        i < contours.size();
        i++
    ) {

        let contour =
            contours.get(i);


        let area =
            cv.contourArea(
                contour
            );


        if (
            area > bestArea &&
            area > 20
        ) {

            if (bestContour) {

                bestContour.delete();

            }


            bestContour =
                contour;


            bestArea =
                area;

        }

        else {

            contour.delete();

        }

    }


    // ========================================
    // PEN TIP FOUND
    // ========================================

    if (bestContour) {

        let moments =
            cv.moments(
                bestContour
            );


        if (
            moments.m00 !== 0
        ) {

            let centerX =
                moments.m10 /
                moments.m00;


            let centerY =
                moments.m01 /
                moments.m00;


            // ==================================
            // SCALE TO CAMERA
            // ==================================

            let cameraX =
                centerX *
                (
                    processingCanvas.width /
                    320
                );


            let cameraY =
                centerY *
                (
                    processingCanvas.height /
                    240
                );


            // ==================================
            // SMOOTH POSITION
            // ==================================

            if (
                smoothX === null
            ) {

                smoothX =
                    cameraX;

                smoothY =
                    cameraY;

            }

            else {

                const smoothing =
                    0.35;


                smoothX =
                    smoothX +
                    (
                        cameraX -
                        smoothX
                    ) *
                    smoothing;


                smoothY =
                    smoothY +
                    (
                        cameraY -
                        smoothY
                    ) *
                    smoothing;

            }


            // ==================================
            // SHOW DOT
            // ==================================

            showDetectedPosition(

                smoothX,

                smoothY

            );


            // ==================================
            // WRITE
            // ==================================

            drawAirWriting(

                smoothX,

                smoothY

            );


            statusText.innerText =
                "🟢 Pen tip detected — Writing";

        }


        bestContour.delete();

    }

    else {

        detectedDot.style.display =
            "none";


        /*
          IMPORTANT:
          Do NOT immediately connect the next
          detected point after losing the marker.
        */

        previousX =
            null;


        previousY =
            null;


        smoothX =
            null;


        smoothY =
            null;


        statusText.innerText =
            "Searching for pen tip...";

    }


    // ========================================
    // FREE OPENCV MEMORY
    // ========================================

    src.delete();

    small.delete();

    hsv.delete();

    lower.delete();

    upper.delete();

    mask.delete();

    kernel.delete();

    contours.delete();

    hierarchy.delete();


    // ========================================
    // NEXT FRAME
    // ========================================

    requestAnimationFrame(
        detectPen
    );

}


// ============================================
// SHOW DETECTED POINT
// ============================================

function showDetectedPosition(

    x,

    y

) {

    const scaleX =
        camera.clientWidth /
        processingCanvas.width;


    const scaleY =
        camera.clientHeight /
        processingCanvas.height;


    const screenX =
        x * scaleX;


    const screenY =
        y * scaleY;


    detectedDot.style.display =
        "block";


    detectedDot.style.left =
        screenX + "px";


    detectedDot.style.top =
        screenY + "px";

}


// ============================================
// DRAW AIR WRITING
// ============================================

function drawAirWriting(

    cameraX,

    cameraY

) {

    const drawX =
        cameraX *
        (
            drawingCanvas.width /
            processingCanvas.width
        );


    const drawY =
        cameraY *
        (
            drawingCanvas.height /
            processingCanvas.height
        );


    // ========================================
    // FIRST POINT
    // ========================================

    if (

        previousX === null ||
        previousY === null

    ) {

        previousX =
            drawX;


        previousY =
            drawY;


        return;

    }


    // ========================================
    // DISTANCE
    // ========================================

    const dx =
        drawX -
        previousX;


    const dy =
        drawY -
        previousY;


    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    // ========================================
    // DRAW
    // ========================================

    if (
        distance < 80
    ) {

        drawingContext.beginPath();


        drawingContext.moveTo(

            previousX,
            previousY

        );


        drawingContext.lineTo(

            drawX,
            drawY

        );


        drawingContext.strokeStyle =
            penColor;


        drawingContext.lineWidth =
            penWidth;


        drawingContext.lineCap =
            "round";


        drawingContext.lineJoin =
            "round";


        drawingContext.stroke();

    }


    previousX =
        drawX;


    previousY =
        drawY;

}


// ============================================
// STOP CAMERA
// ============================================

function stopCamera() {

    detectionRunning =
        false;


    previousX =
        null;


    previousY =
        null;


    smoothX =
        null;


    smoothY =
        null;


    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(

                function(track) {

                    track.stop();

                }

            );


        cameraStream =
            null;

    }


    camera.srcObject =
        null;


    detectedDot.style.display =
        "none";


    cameraMessage.style.display =
        "block";


    cameraMessage.innerText =
        "Camera stopped";


    startCameraBtn.disabled =
        !openCVReady;


    stopCameraBtn.disabled =
        true;


    statusText.innerText =
        "Camera stopped";

}


// ============================================
// CLEAR
// ============================================

function clearCanvas() {

    drawingContext.fillStyle =
        "white";


    drawingContext.fillRect(

        0,

        0,

        drawingCanvas.width,

        drawingCanvas.height

    );


    previousX =
        null;


    previousY =
        null;


    statusText.innerText =
        "Writing cleared";

}


// ============================================
// SAVE
// ============================================

function saveImage() {

    const image =
        drawingCanvas.toDataURL(
            "image/png"
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        image;


    link.download =
        "air-writing.png";


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    statusText.innerText =
        "Image saved 💾";

}


// ============================================
// BUTTONS
// ============================================

startCameraBtn.addEventListener(

    "click",

    startCamera

);


stopCameraBtn.addEventListener(

    "click",

    stopCamera

);


clearBtn.addEventListener(

    "click",

    clearCanvas

);


saveBtn.addEventListener(

    "click",

    saveImage

);


// ============================================
// PAGE CLOSE
// ============================================

window.addEventListener(

    "beforeunload",

    stopCamera

);
