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
        showError('Supabase library failed to load. Please refresh the page.');
        return;
    }

    try {
        // Create Supabase client with proper configuration
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                flowType: 'pkce'
            }
        });

        console.log('Supabase client created successfully');
        
        // Wait for Ethereum provider to be available
        waitForEthereumProvider();
    } catch (error) {
        console.error('Failed to create Supabase client:', error);
        showError('Failed to initialize authentication. Please refresh the page.');
    }
}

function waitForEthereumProvider() {
    console.log('Checking for Ethereum provider...');
    
    if (typeof window.ethereum !== 'undefined') {
        console.log('Ethereum provider found immediately');
        setupApp();
    } else {
        console.log('Waiting for Ethereum provider...');
        
        let checks = 0;
        const maxChecks = 30; // 3 seconds timeout
        
        const checkInterval = setInterval(() => {
            checks++;
            
            if (typeof window.ethereum !== 'undefined') {
                console.log('Ethereum provider found after', checks * 100, 'ms');
                clearInterval(checkInterval);
                setupApp();
            }
            
            if (checks >= maxChecks) {
                clearInterval(checkInterval);
                console.error('Ethereum wallet not detected after timeout');
                showError('Please install MetaMask or another Ethereum wallet to continue.');
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
    
    console.log('Setting up application...');
    console.log('Ethereum provider:', window.ethereum ? 'Available' : 'Not available');
    
    // Set up event listeners when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
    
    isInitialized = true;
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (signInBtn) {
        signInBtn.addEventListener('click', signInWithWeb3);
        signInBtn.style.display = 'block';
        console.log('Sign in button listener added');
    }
    
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
        console.log('Sign out button listener added');
    }
    
    // Check user status after a brief delay to ensure Supabase is ready
    setTimeout(() => {
        checkUser();
    }, 500);
    
    // Listen for auth state changes
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session ? 'Session available' : 'No session');
            checkUser();
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

        console.log('Initiating Web3 sign-in...');
        
        // Request account access first
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Sign in with Web3
        const { data, error } = await supabaseClient.auth.signInWithWeb3({
            provider: window.ethereum,
            chain: 'ethereum',
            statement: 'Sign in to access the application'
        });

        if (error) {
            throw error;
        }

        console.log('Web3 sign-in successful:', data);
        
    } catch (error) {
        console.error('Sign-in error:', error);
        
        // Handle specific errors
        if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('canceled')) {
            showError('Sign-in cancelled by user');
        } else if (error.message?.includes('User rejected')) {
            showError('Sign-in rejected by wallet');
        } else if (error.message?.includes('AuthSessionMissingError')) {
            showError('Authentication session error. Please try again.');
        } else {
            showError(error.message || 'Sign-in failed. Please try again.');
        }
    } finally {
        setLoading(false, document.getElementById('signInBtn'));
    }
}

async function handleSignOut() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        
        setLoading(true, document.getElementById('signOutBtn'));
        console.log('Signing out...');
        
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            throw error;
        }
        
        console.log('Signed out successfully');
        
    } catch (error) {
        console.error('Sign-out error:', error);
        showError('Sign-out failed: ' + error.message);
    } finally {
        setLoading(false, document.getElementById('signOutBtn'));
        checkUser();
    }
}

async function checkUser() {
    try {
        if (!supabaseClient) {
            console.log('Supabase client not available for user check');
            return;
        }
        
        console.log('Checking user authentication status...');
        
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.error('Error getting user:', error);
            // Don't show error to user for session missing errors during initial check
            if (!error.message.includes('AuthSessionMissingError')) {
                showError('Failed to check user status');
            }
            return;
        }
        
        const userInfo = document.getElementById('userInfo');
        const signInBtn = document.getElementById('signInBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        
        if (user) {
            // User is logged in
            console.log('User is authenticated:', user);
            userInfo.style.display = 'block';
            document.getElementById('userEmail').textContent = user.email || 'No email';
            document.getElementById('userAddress').textContent = user.user_metadata?.wallet_address || 'No wallet address';
            document.getElementById('userId').textContent = user.id;
            
            if (signInBtn) signInBtn.style.display = 'none';
            if (signOutBtn) signOutBtn.style.display = 'block';
        } else {
            // User is not logged in
            console.log('User is not authenticated');
            userInfo.style.display = 'none';
            if (signInBtn) signInBtn.style.display = 'block';
            if (signOutBtn) signOutBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error in checkUser:', error);
        // Don't show session missing errors to users during initial load
        if (!error.message.includes('AuthSessionMissingError')) {
            showError('Failed to check authentication status');
        }
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.style.color = '#ef4444';
        errorDiv.style.marginTop = '1rem';
        errorDiv.style.padding = '0.5rem';
        errorDiv.style.borderRadius = '0.25rem';
        errorDiv.style.backgroundColor = '#fef2f2';
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
            button.textContent = button.id === 'signInBtn' ? 'Connecting...' : 'Signing out...';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            button.textContent = button.id === 'signInBtn' ? 'Sign in with Web3 (Ethereum)' : 'Sign Out';
        }
    }
}

// Initialize the app when everything is loaded
window.addEventListener('load', initializeApp);

// Also initialize if Supabase loads after window load
if (document.readyState === 'complete') {
    initializeApp();
}