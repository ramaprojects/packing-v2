const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('btn-login');
const errorMessage = document.getElementById('error-message');

async function handleLogin() {
    const enteredPassword = passwordInput.value;
    if (!enteredPassword) return;

    loginButton.disabled = true;
    loginButton.textContent = 'Memeriksa...';
    errorMessage.classList.add('d-none');

    try {
        const url = `https://script.google.com/macros/s/AKfycbzeH8L2iOUU6mLThF84giiuQp0KetyCW6D8i_iFyh11MYGr7KAFBR0HJyCXv8OsmhOW/exec?type=login&password=${encodeURIComponent(enteredPassword)}`;
        
        const response = await fetch(url, { method: 'POST' });
        const result = await response.json();

        if (result.status === 'success') {
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = 'index.html';
        } else {
            throw new Error(result.message || 'Password salah');
        }

    } catch (error) {
        errorMessage.classList.remove('d-none');
        errorMessage.textContent = error.message;
        loginButton.disabled = false;
        loginButton.textContent = 'Masuk';
    }
}

loginButton.addEventListener('click', handleLogin);

passwordInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        handleLogin();
    }
});
