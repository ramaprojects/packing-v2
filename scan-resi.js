(() => {
    const btnScan = document.getElementById('btn-scan-resi');
    const btnClose = document.getElementById('btn-close-scan');
    const inputResi = document.getElementById('input-resi-number');
    const btnFinish = document.getElementById('btn-finish-resi');
    const container = document.getElementById('scanner-container');

    if (!btnScan || !container) return;

    let scanning = false;

    function startScan() {
        if (scanning) return;
        scanning = true;

        container.style.display = 'block';

        Quagga.init({
            inputStream: {
                type: "LiveStream",
                target: document.querySelector('#scanner'),
                constraints: {
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "code_39_reader"
                ]
            },
            locate: true
        }, err => {
            if (err) {
                console.error(err);
                stopScan();
                return;
            }
            Quagga.start();
        });
    }

    function stopScan() {
        if (!scanning) return;
        scanning = false;

        Quagga.stop();
        container.style.display = 'none';
    }

    btnScan.addEventListener('click', startScan);
    btnClose.addEventListener('click', stopScan);

    Quagga.onDetected(result => {
        const code = result?.codeResult?.code;
        if (!code) return;

        inputResi.value = code;
        btnFinish.disabled = true;

        stopScan();
    });
})();
