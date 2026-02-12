
(function() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (isLoggedIn !== 'true') {
        window.location.replace('login.html'); 
    }
})();
