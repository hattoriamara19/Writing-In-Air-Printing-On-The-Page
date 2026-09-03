// =====================================
// AIR PEN WRITING
// PHASE 1
// CAMERA + DRAWING CANVAS
// =====================================


// Get HTML elements

const camera =
    document.getElementById("camera");


const statusText =
    document.getElementById("status");


const cameraMessage =
    document.getElementById("cameraMessage");


const startCameraBtn =
    document.getElementById("startCameraBtn");


const stopCameraBtn =
    document.getElementById("stopCameraBtn");


const clearBtn =
    document.getElementById("clearBtn");


const saveBtn =
    document.getElementById("saveBtn");


const drawingCanvas =
    document.getElementById("drawingCanvas");


const drawingContext =
    drawingCanvas.getContext("2d");


let cameraStream = null;


// =====================================
// SET UP DRAWING CANVAS
// =====================================

function resizeCanvas() {

    const rectangle =
        drawingCanvas.getBoundingClientRect();


    drawingCanvas.width =
        rectangle.width;


    drawingCanvas.height =
        rectangle.height;


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


window.addEventListener(
    "resize",
    resizeCanvas
);



// =====================================
// START CAMERA
// =====================================

async function startCamera() {

    try {

        statusText.innerText =
            "Requesting camera permission...";


        cameraMessage.innerText =
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


        statusText.innerText =
            "Camera started successfully 📷";


        startCameraBtn.disabled =
            true;


        stopCameraBtn.disabled =
            false;


    }

    catch (error) {

        console.error(error);


        statusText.innerText =
            "Camera error: " + error.message;


        cameraMessage.innerText =
            "Camera could not start";


        alert(
            "Camera could not start.\n\n" +
            "Make sure you allow camera permission."
        );

    }

}



// =====================================
// STOP CAMERA
// =====================================

function stopCamera() {

    if (cameraStream) {

        const tracks =
            cameraStream.getTracks();


        tracks.forEach(function(track) {

            track.stop();

        });


        cameraStream =
            null;

    }


    camera.srcObject =
        null;


    cameraMessage.style.display =
        "block";


    cameraMessage.innerText =
        "Camera stopped";


    statusText.innerText =
        "Camera stopped";


    startCameraBtn.disabled =
        false;


    stopCameraBtn.disabled =
        true;

}



// =====================================
// CLEAR DRAWING CANVAS
// =====================================

function clearCanvas() {

    drawingContext.fillStyle =
        "white";


    drawingContext.fillRect(

        0,

        0,

        drawingCanvas.width,

        drawingCanvas.height

    );


    statusText.innerText =
        "Writing cleared";

}



// =====================================
// SAVE DRAWING AS IMAGE
// =====================================

function saveImage() {

    const imageData =
        drawingCanvas.toDataURL(
            "image/png"
        );


    const downloadLink =
        document.createElement("a");


    downloadLink.href =
        imageData;


    downloadLink.download =
        "air-writing.png";


    document.body.appendChild(
        downloadLink
    );


    downloadLink.click();


    document.body.removeChild(
        downloadLink
    );


    statusText.innerText =
        "Image saved successfully 💾";

}



// =====================================
// BUTTON EVENTS
// =====================================

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



// =====================================
// CLEAN UP CAMERA
// =====================================

window.addEventListener(
    "beforeunload",
    stopCamera
);
