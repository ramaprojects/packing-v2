const SUPER_SECRET_PASSWORD = "rama123"; 

const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('btn-login');
const errorMessage = document.getElementById('error-message');

function handleLogin() {
    const enteredPassword = passwordInput.value;

    if (enteredPassword === SUPER_SECRET_PASSWORD) {
        localStorage.setItem('isLoggedIn', 'true');
        window.location.href = 'index.html'; 
    } else {
        errorMessage.classList.remove('d-none');
        passwordInput.focus();
    }
}

loginButton.addEventListener('click', handleLogin);

passwordInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        handleLogin();
    }
});
