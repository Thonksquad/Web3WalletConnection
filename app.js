// app.js - Main application logic

// Wait for the Supabase library to load and initialize everything
function initializeApp() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded yet');
        return;
    }

    // Create Supabase client using config from config.js
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

    // DOM Elements
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const userInfo = document.getElementById('userInfo');
    const errorDiv = document.getElementById('error');

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Add event listeners instead of using inline onclick
        signInBtn.addEventListener('click', function() {
            signInWithWeb3(supabaseClient);
        });
        signOutBtn.addEventListener('click', function() {
            signOut(supabaseClient);
        });
        
        checkUser(supabaseClient);
        
        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            checkUser(supabaseClient);
        });
    });

    async function signInWithWeb3(supabase) {
        try {
            hideError();
            setLoading(true, signInBtn);
            
            const { data, error } = await supabase.auth.signInWithWeb3({
                chain: 'ethereum',
                statement: 'I accept the Terms of Service',
            });

            if (error) {
                throw error;
            }

            console.log('Web3 sign-in initiated:', data);
            alert('Please check your wallet to complete the sign-in process!');
            
        } catch (error) {
            console.error('Sign-in error:', error);
            showError(error.message);
        } finally {
            setLoading(false, signInBtn);
        }
    }

    async function signOut(supabase) {
        try {
            setLoading(true, signOutBtn);
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                throw error;
            }
            
            console.log('Signed out successfully');
            checkUser(supabase);
            
        } catch (error) {
            console.error('Sign-out error:', error);
            showError(error.message);
        } finally {
            setLoading(false, signOutBtn);
        }
    }

    async function checkUser(supabase) {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error) {
                throw error;
            }
            
            if (user) {
                // User is logged in
                userInfo.style.display = 'block';
                document.getElementById('userEmail').textContent = user.email || 'No email';
                document.getElementById('userAddress').textContent = user.user_metadata?.wallet_address || 'No wallet address';
                document.getElementById('userId').textContent = user.id;
                
                signInBtn.style.display = 'none';
                signOutBtn.style.display = 'block';
            } else {
                // User is not logged in
                userInfo.style.display = 'none';
                signInBtn.style.display = 'block';
                signOutBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking user:', error);
            showError('Failed to check user status');
        }
    }

    function showError(message) {
        errorDiv.textContent = `Error: ${message}`;
        errorDiv.style.display = 'block';
    }

    function hideError() {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }

    function setLoading(isLoading, button) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    // Make functions available globally if needed for other scripts
    window.signInWithWeb3 = function() {
        signInWithWeb3(supabaseClient);
    };
    window.signOut = function() {
        signOut(supabaseClient);
    };
}

// Wait for the Supabase library to load
if (typeof supabase !== 'undefined') {
    initializeApp();
} else {
    // If supabase isn't loaded yet, wait for it
    window.addEventListener('load', initializeApp);
}