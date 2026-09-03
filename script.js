const video = document.getElementById("camera");

function startCamera() {

    navigator.mediaDevices
        .getUserMedia({
            video: {
                facingMode: "environment"
            }
        })

        .then(function(stream) {

            video.srcObject = stream;

        })

        .catch(function(error) {

            alert("Camera error: " + error);

        });
}
