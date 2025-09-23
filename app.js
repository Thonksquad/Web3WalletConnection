// app.js - Main application logic
let supabaseClient = null;
let isInitialized = false;

// Hardcoded Supabase configuration
const SUPABASE_CONFIG = {
    URL: 'https://spi.t.rodasapc.space/',
    ANON_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1ODI3NjU0MCwiZXhwIjo0OTEzOTUwMTQwLCJyb2xlIjoiYW5vbiJ9.sHNHvwS4haQTnJ-MJ2n1NMnQLUg87pCd2DuxeWAkdCk'
};

// Initialize the application
function initializeApp() {
    console.log('Initializing app...');
    console.log('Supabase URL:', SUPABASE_CONFIG.URL);
    console.log('Supabase Key:', SUPABASE_CONFIG.ANON_KEY ? 'Set' : 'Not set');

    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded');
        showError('Supabase library failed to load');
        return;
    }

    // Create Supabase client
    const { createClient } = supabase;
    supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

    // Wait for Ethereum provider to be available
    waitForEthereumProvider();
}

function waitForEthereumProvider() {
    console.log('Checking for Ethereum provider...');
    console.log('window.ethereum:', window.ethereum);
    
    if (typeof window.ethereum !== 'undefined') {
        console.log('Ethereum provider found immediately:', window.ethereum);
        setupApp();
    } else {
        console.log('Waiting for Ethereum provider...');
        
        let checks = 0;
        const checkInterval = setInterval(() => {
            checks++;
            console.log(`Check #${checks} for window.ethereum`);
            
            if (typeof window.ethereum !== 'undefined') {
                console.log('Ethereum provider found after', checks * 100, 'ms:', window.ethereum);
                clearInterval(checkInterval);
                setupApp();
            }
            
            // Stop checking after 10 attempts (5 seconds)
            if (checks >= 50) {
                clearInterval(checkInterval);
                console.error('Ethereum wallet not detected after timeout');
                showError('Please make sure MetaMask is installed and refresh the page');
                const signInBtn = document.getElementById('signInBtn');
                if (signInBtn) {
                    signInBtn.style.display = 'none';
                }
            }
        }, 100);
    }
}

function setupApp() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('Ethereum provider detected:', window.ethereum);
    console.log('Supabase client initialized with URL:', SUPABASE_CONFIG.URL);
    
    // Set up event listeners when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
}

function setupEventListeners() {
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (signInBtn) {
        signInBtn.addEventListener('click', signInWithWeb3);
        signInBtn.style.display = 'block'; // Make sure it's visible
    }
    
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => signOut(supabaseClient));
    }
    
    checkUser(supabaseClient);
    
    // Listen for auth state changes
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            checkUser(supabaseClient);
        });
    }
}

async function signInWithWeb3() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        
        if (typeof window.ethereum === 'undefined') {
            throw new Error('Ethereum wallet not available. Please install MetaMask.');
        }
        
        hideError();
        setLoading(true, document.getElementById('signInBtn'));

        // This should trigger MetaMask to open and request signature
        const { data, error } = await supabaseClient.auth.signInWithWeb3({
            chain: 'ethereum',
            statement: 'I accept the Terms of Service'
        });

        if (error) {
            throw error;
        }

        console.log('Web3 sign-in initiated:', data);
        
    } catch (error) {
        console.error('Sign-in error:', error);
        
        // Handle specific Ethereum errors
        if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('canceled')) {
            showError('Sign-in cancelled by user');
        } else if (error.message?.includes('User rejected')) {
            showError('Sign-in rejected by wallet');
        } else {
            showError(error.message || 'Sign-in failed');
        }
    } finally {
        setLoading(false, document.getElementById('signInBtn'));
    }
}

async function signOut(supabase) {
    try {
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }
        
        setLoading(true, document.getElementById('signOutBtn'));
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
        setLoading(false, document.getElementById('signOutBtn'));
    }
}

async function checkUser(supabase) {
    try {
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            throw error;
        }
        
        const userInfo = document.getElementById('userInfo');
        const signInBtn = document.getElementById('signInBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        
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
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = `Error: ${message}`;
        errorDiv.style.display = 'block';
    }
}

function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
}

function setLoading(isLoading, button) {
    if (button) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
            button.textContent = 'Loading...';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            button.textContent = 'Sign in with Web3 (Ethereum)';
        }
    }
}

// Initialize the app when everything is loaded
window.addEventListener('load', initializeApp);