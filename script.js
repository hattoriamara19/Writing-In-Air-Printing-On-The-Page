// ======================================
// AIR PEN WRITING
// PHASE 3 + PHASE 4
// PEN TRACKING + AIR WRITING
// ======================================


// ======================================
// GET HTML ELEMENTS
// ======================================

const camera =
    document.getElementById("camera");

const statusText =
    document.getElementById("status");

const cameraMessage =
    document.getElementById("cameraMessage");

const detectedDot =
    document.getElementById("detectedDot");

const processingCanvas =
    document.getElementById("processingCanvas");

const processingContext =
    processingCanvas.getContext("2d");

const drawingCanvas =
    document.getElementById("drawingCanvas");

const drawingContext =
    drawingCanvas.getContext("2d");

const startCameraBtn =
    document.getElementById("startCameraBtn");

const stopCameraBtn =
    document.getElementById("stopCameraBtn");

const clearBtn =
    document.getElementById("clearBtn");

const saveBtn =
    document.getElementById("saveBtn");


// ======================================
// VARIABLES
// ======================================

let cameraStream = null;

let detectionRunning = false;


// Previous pen position

let previousX = null;

let previousY = null;


// Pen settings

let penColor = "black";

let penWidth = 5;


// ======================================
// SET UP DRAWING CANVAS
// ======================================

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


// ======================================
// START CAMERA
// ======================================

async function startCamera() {

    try {

        statusText.innerText =
            "Starting camera...";


        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: {

                        ideal: "environment"

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

                startDetection();

            };


        statusText.innerText =
            "Camera started. Looking for green pen marker 🟢";


    }

    catch (error) {

        console.error(error);


        statusText.innerText =
            "Camera error: " + error.message;


        alert(

            "Camera could not start.\n\n" +

            "Please allow camera permission."

        );

    }

}


// ======================================
// START DETECTION
// ======================================

function startDetection() {

    detectionRunning = true;


    processingCanvas.width =
        camera.videoWidth;


    processingCanvas.height =
        camera.videoHeight;


    previousX = null;

    previousY = null;


    detectPen();

}


// ======================================
// DETECT PEN MARKER
// ======================================

function detectPen() {

    if (!detectionRunning) {

        return;

    }


    // Copy camera frame

    processingContext.drawImage(

        camera,

        0,

        0,

        processingCanvas.width,

        processingCanvas.height

    );


    // Read camera pixels

    const imageData =
        processingContext.getImageData(

            0,

            0,

            processingCanvas.width,

            processingCanvas.height

        );


    const data =
        imageData.data;


    let totalX = 0;

    let totalY = 0;

    let greenPixels = 0;


    // Search for green pixels

    for (

        let y = 0;

        y < processingCanvas.height;

        y += 4

    ) {

        for (

            let x = 0;

            x < processingCanvas.width;

            x += 4

        ) {

            const index =

                (y * processingCanvas.width + x)

                * 4;


            const red =
                data[index];


            const green =
                data[index + 1];


            const blue =
                data[index + 2];


            // Green detection

            if (

                green > 120 &&

                green > red * 1.3 &&

                green > blue * 1.2

            ) {


                totalX += x;

                totalY += y;

                greenPixels++;

            }

        }

    }


    // ==================================
    // IF PEN MARKER IS FOUND
    // ==================================

    if (greenPixels > 10) {


        const centerX =

            totalX / greenPixels;


        const centerY =

            totalY / greenPixels;


        // Show red detection circle

        showDetectedPosition(

            centerX,

            centerY

        );


        // Draw using pen position

        drawAirWriting(

            centerX,

            centerY

        );


        statusText.innerText =

            "🟢 Pen detected — Writing";


    }

    else {


        detectedDot.style.display =
            "none";


        // Reset previous position

        previousX = null;

        previousY = null;


        statusText.innerText =

            "Searching for green pen marker...";

    }


    // Continue detection

    requestAnimationFrame(

        detectPen

    );

}


// ======================================
// SHOW DETECTED PEN POSITION
// ======================================

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


// ======================================
// DRAW AIR WRITING
// ======================================

function drawAirWriting(

    cameraX,

    cameraY

) {


    // Convert camera position
    // to drawing canvas position


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


    // First point

    if (

        previousX === null ||

        previousY === null

    ) {


        previousX = drawX;

        previousY = drawY;


        return;

    }


    // Draw line

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


    // Save new position

    previousX = drawX;

    previousY = drawY;

}


// ======================================
// STOP CAMERA
// ======================================

function stopCamera() {


    detectionRunning =
        false;


    previousX = null;

    previousY = null;


    if (cameraStream) {


        cameraStream

            .getTracks()

            .forEach(function (track) {


                track.stop();


            });


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
        false;


    stopCameraBtn.disabled =
        true;


    statusText.innerText =
        "Camera stopped";

}


// ======================================
// CLEAR WRITING
// ======================================

function clearCanvas() {


    drawingContext.fillStyle =
        "white";


    drawingContext.fillRect(

        0,

        0,

        drawingCanvas.width,

        drawingCanvas.height

    );


    previousX = null;

    previousY = null;


    statusText.innerText =
        "Writing cleared";

}


// ======================================
// SAVE IMAGE
// ======================================

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


// ======================================
// BUTTON EVENTS
// ======================================

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


// ======================================
// CLOSE CAMERA WHEN PAGE CLOSES
// ======================================

window.addEventListener(

    "beforeunload",

    stopCamera

);
