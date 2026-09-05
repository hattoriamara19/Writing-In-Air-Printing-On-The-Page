// ============================================
// AIR PEN WRITING
// VERSION 4
//
// FRONT CAMERA
// NORMAL BALL PEN
// OPENCV.JS
//
// Detection:
// Grayscale
// Blur
// Adaptive threshold
// Contours
// Shape filtering
// Pen-tip estimation
// Position smoothing
// Air writing
// ============================================


// ============================================
// HTML ELEMENTS
// ============================================

const camera =
    document.getElementById("camera");

const processingCanvas =
    document.getElementById("processingCanvas");

const processingContext =
    processingCanvas.getContext(
        "2d",
        {
            willReadFrequently: true
        }
    );

const drawingCanvas =
    document.getElementById("drawingCanvas");

const drawingContext =
    drawingCanvas.getContext("2d");

const detectedDot =
    document.getElementById("detectedDot");

const cameraMessage =
    document.getElementById("cameraMessage");

const statusText =
    document.getElementById("status");

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


// Previous drawing position

let previousX = null;

let previousY = null;


// Smoothed position

let smoothX = null;

let smoothY = null;


// Pen appearance

let penColor = "black";

let penWidth = 5;


// ============================================
// DETECTION PARAMETERS
// ============================================

const PROCESS_WIDTH = 320;

const PROCESS_HEIGHT = 240;


// Minimum contour size

const MIN_AREA = 30;


// Maximum contour size

const MAX_AREA = 15000;


// ============================================
// OPENCV READY
// ============================================

function onOpenCvReady() {

    openCVReady = true;

    statusText.innerText =
        "OpenCV loaded. Ready.";

    startCameraBtn.disabled = false;
}

window.onOpenCvReady =
    onOpenCvReady;


// ============================================
// DRAWING CANVAS
// ============================================

function resizeCanvas() {

    const rect =
        drawingCanvas.getBoundingClientRect();

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
// START FRONT CAMERA
// ============================================

async function startCamera() {

    if (!openCVReady) {

        alert(
            "OpenCV is still loading."
        );

        return;
    }

    try {

        statusText.innerText =
            "Starting front camera...";


        /*
         * IMPORTANT:
         *
         * facingMode = user
         *
         * means FRONT CAMERA.
         */

        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {
                            exact: "user"
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


        /*
         * Some phones may not support
         * exact user camera selection.
         *
         * Try normal front camera.
         */

        try {

            cameraStream =
                await navigator.mediaDevices
                    .getUserMedia({

                        video: {
                            facingMode: "user"
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

        catch (secondError) {

            console.error(
                secondError
            );


            statusText.innerText =
                "Camera error";


            alert(
                "Front camera could not start.\n\n" +
                "Please allow camera permission."
            );

        }

    }

}


// ============================================
// START DETECTION
// ============================================

function startDetection() {

    detectionRunning =
        true;


    previousX = null;

    previousY = null;

    smoothX = null;

    smoothY = null;


    detectPen();

}


// ============================================
// DETECT PEN
// ============================================

function detectPen() {

    if (!detectionRunning) {

        return;
    }


    // ========================================
    // DRAW CAMERA INTO PROCESSING CANVAS
    // ========================================

    processingContext.drawImage(

        camera,

        0,
        0,

        processingCanvas.width,
        processingCanvas.height

    );


    // ========================================
    // READ IMAGE
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
            PROCESS_WIDTH,
            PROCESS_HEIGHT
        )

    );


    // ========================================
    // GRAYSCALE
    // ========================================

    let gray =
        new cv.Mat();


    cv.cvtColor(

        small,

        gray,

        cv.COLOR_RGBA2GRAY

    );


    // ========================================
    // BLUR
    // ========================================

    let blurred =
        new cv.Mat();


    cv.GaussianBlur(

        gray,

        blurred,

        new cv.Size(
            5,
            5
        ),

        0

    );


    // ========================================
    // ADAPTIVE THRESHOLD
    // ========================================

    let binary =
        new cv.Mat();


    cv.adaptiveThreshold(

        blurred,

        binary,

        255,

        cv.ADAPTIVE_THRESH_GAUSSIAN_C,

        cv.THRESH_BINARY_INV,

        21,

        7

    );


    // ========================================
    // MORPHOLOGY
    // ========================================

    let kernel =
        cv.Mat.ones(

            3,
            3,
            cv.CV_8U

        );


    cv.morphologyEx(

        binary,

        binary,

        cv.MORPH_OPEN,

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

        binary,

        contours,

        hierarchy,

        cv.RETR_EXTERNAL,

        cv.CHAIN_APPROX_SIMPLE

    );


    // ========================================
    // SEARCH FOR PEN
    // ========================================

    let bestContour = null;

    let bestScore = 0;


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


        // Ignore tiny objects

        if (
            area < MIN_AREA
        ) {

            contour.delete();

            continue;

        }


        // Ignore huge objects

        if (
            area > MAX_AREA
        ) {

            contour.delete();

            continue;

        }


        let rect =
            cv.boundingRect(
                contour
            );


        let width =
            rect.width;

        let height =
            rect.height;


        if (
            width < 8 ||
            height < 8
        ) {

            contour.delete();

            continue;

        }


        // ==================================
        // ASPECT RATIO
        // ==================================

        let longest =
            Math.max(
                width,
                height
            );


        let shortest =
            Math.min(
                width,
                height
            );


        let aspect =
            longest /
            shortest;


        /*
         * A pen normally forms a
         * relatively long object.
         */

        if (
            aspect < 2
        ) {

            contour.delete();

            continue;

        }


        // ==================================
        // RECTANGULARITY
        // ==================================

        let rectangleArea =
            width *
            height;


        let rectangularity =
            area /
            rectangleArea;


        /*
         * Extremely irregular noise
         * is rejected.
         */

        if (
            rectangularity < 0.10
        ) {

            contour.delete();

            continue;

        }


        // ==================================
        // SCORE
        // ==================================

        let score =
            aspect *
            rectangularity *
            area;


        if (
            score >
            bestScore
        ) {

            if (bestContour) {

                bestContour.delete();

            }


            bestContour =
                contour;

            bestScore =
                score;

        }

        else {

            contour.delete();

        }

    }


    // ========================================
    // PEN FOUND
    // ========================================

    if (bestContour) {

        let rect =
            cv.boundingRect(
                bestContour
            );


        let tip =
            estimatePenTip(
                bestContour,
                rect
            );


        // ==================================
        // SCALE BACK
        // ==================================

        let cameraX =
            tip.x *
            (
                processingCanvas.width /
                PROCESS_WIDTH
            );


        let cameraY =
            tip.y *
            (
                processingCanvas.height /
                PROCESS_HEIGHT
            );


        // ==================================
        // SMOOTH
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
                0.30;


            smoothX +=
                (
                    cameraX -
                    smoothX
                ) *
                smoothing;


            smoothY +=
                (
                    cameraY -
                    smoothY
                ) *
                smoothing;

        }


        // ==================================
        // DISPLAY POINT
        // ==================================

        showDetectedPosition(

            smoothX,
            smoothY

        );


        // ==================================
        // DRAW
        // ==================================

        drawAirWriting(

            smoothX,
            smoothY

        );


        statusText.innerText =
            "✍️ Pen detected — Writing";


        bestContour.delete();

    }

    else {

        detectedDot.style.display =
            "none";


        /*
         * Do not connect writing across
         * a lost detection.
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
            "Searching for pen...";

    }


    // ========================================
    // RELEASE OPENCV MEMORY
    // ========================================

    src.delete();

    small.delete();

    gray.delete();

    blurred.delete();

    binary.delete();

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
// ESTIMATE PEN TIP
// ============================================

function estimatePenTip(
    contour,
    rect
) {

    /*
     * We find the contour points closest
     * to the two ends of the bounding box.
     */

    let points = [];


    for (
        let i = 0;
        i < contour.data32S.length;
        i += 2
    ) {

        points.push({

            x:
                contour.data32S[i],

            y:
                contour.data32S[i + 1]

        });

    }


    // ========================================
    // HORIZONTAL PEN
    // ========================================

    if (
        rect.width >=
        rect.height
    ) {

        let left =
            points[0];

        let right =
            points[0];


        for (
            const p of points
        ) {

            if (
                p.x <
                left.x
            ) {

                left =
                    p;

            }


            if (
                p.x >
                right.x
            ) {

                right =
                    p;

            }

        }


        /*
         * Select the end with the
         * smaller local width.
         *
         * This approximates the pointed
         * pen-tip side.
         */

        let leftDistance =
            distanceFromCorner(
                left,
                rect.x,
                rect.y,
                rect.height
            );


        let rightDistance =
            distanceFromCorner(
                right,
                rect.x +
                rect.width,
                rect.y,
                rect.height
            );


        if (
            leftDistance <
            rightDistance
        ) {

            return left;

        }

        return right;

    }


    // ========================================
    // VERTICAL PEN
    // ========================================

    let top =
        points[0];

    let bottom =
        points[0];


    for (
        const p of points
    ) {

        if (
            p.y <
            top.y
        ) {

            top =
                p;

        }


        if (
            p.y >
            bottom.y
        ) {

            bottom =
                p;

        }

    }


    let topDistance =
        distanceFromCorner(
            top,
            rect.x,
            rect.y,
            rect.width
        );


    let bottomDistance =
        distanceFromCorner(
            bottom,
            rect.x,
            rect.y +
            rect.height,
            rect.width
        );


    if (
        topDistance <
        bottomDistance
    ) {

        return top;

    }


    return bottom;

}


// ============================================
// HELPER
// ============================================

function distanceFromCorner(
    point,
    x,
    y,
    size
) {

    const center =
        size / 2;


    return Math.abs(
        point.y -
        (
            y +
            center
        )
    );

}


// ============================================
// SHOW DETECTED POSITION
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


    /*
     * Camera preview is mirrored,
     * therefore mirror X position
     * of detection dot.
     */

    const screenX =
        camera.clientWidth -
        (
            x * scaleX
        );


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

    /*
     * Front camera preview is mirrored.
     * Therefore mirror X for writing too.
     */

    const normalizedX =
        1 -
        (
            cameraX /
            processingCanvas.width
        );


    const normalizedY =
        cameraY /
        processingCanvas.height;


    const drawX =
        normalizedX *
        drawingCanvas.width;


    const drawY =
        normalizedY *
        drawingCanvas.height;


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


    /*
     * Reject sudden jumps.
     */

    if (
        distance < 70
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

        cameraSt
