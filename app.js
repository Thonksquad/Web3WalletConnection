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

    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded');
        showError('Supabase library failed to load. Please refresh the page.');
        return;
    }

    try {
        // Create Supabase client with simpler configuration
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        });

        console.log('Supabase client created successfully');
        
        // Set up the app immediately without waiting for Ethereum
        setupApp();
        
    } catch (error) {
        console.error('Failed to create Supabase client:', error);
        showError('Failed to initialize authentication. Please refresh the page.');
    }
}

function setupApp() {
    if (isInitialized) return;
    
    console.log('Setting up application...');
    
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
    
    // Check user status with a safer approach
    checkUserSafely();
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
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        console.log('Connected account:', accounts[0]);
        
        // Use a different approach for Web3 sign-in
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'ethereum',
            options: {
                queryParams: {
                    chain: 'ethereum',
                    statement: 'Sign in to access the application'
                }
            }
        });

        if (error) {
            throw error;
        }

        console.log('Web3 sign-in initiated:', data);
        
        // Check user after successful sign-in
        setTimeout(() => {
            checkUserSafely();
        }, 2000);
        
    } catch (error) {
        console.error('Sign-in error:', error);
        
        // Handle specific errors
        if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('canceled')) {
            showError('Sign-in cancelled by user');
        } else if (error.message?.includes('User rejected')) {
            showError('Sign-in rejected by wallet');
        } else {
            showError(error.message || 'Sign-in failed. Please try again.');
        }
    } finally {
        setLoading(false, document.getElementById('signInBtn'));
    }
}

// Alternative Web3 sign-in method
async function signInWithWeb3Alternative() {
    try {
        if (!window.ethereum) {
            throw new Error('Ethereum wallet not available');
        }

        // Get the current account
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        const account = accounts[0];
        
        console.log('Signing in with account:', account);
        
        // Create a simple message to sign
        const message = `Sign in to the application at ${new Date().toISOString()}`;
        
        // Sign the message
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, account],
        });
        
        console.log('Signature received:', signature);
        
        // Use the signIn method that doesn't rely on session storage
        const { data, error } = await supabaseClient.auth.signIn({
            address: account,
            signature: signature,
            message: message
        });

        if (error) throw error;
        
        console.log('Sign-in successful:', data);
        return data;
        
    } catch (error) {
        console.error('Alternative sign-in error:', error);
        throw error;
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
        checkUserSafely();
    }
}

// Safer user check that handles session errors gracefully
async function checkUserSafely() {
    try {
        if (!supabaseClient) {
            console.log('Supabase client not available for user check');
            updateUIForUnauthenticated();
            return;
        }
        
        console.log('Checking user authentication status safely...');
        
        // Use a try-catch approach that doesn't throw on missing sessions
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.log('Session check error (non-critical):', sessionError.message);
            // This is expected for unauthenticated users
            updateUIForUnauthenticated();
            return;
        }
        
        if (session) {
            // We have a session, now get the user safely
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError) {
                console.log('User check error:', userError.message);
                updateUIForUnauthenticated();
                return;
            }
            
            if (user) {
                updateUIForAuthenticated(user);
                return;
            }
        }
        
        // No session or user found
        updateUIForUnauthenticated();
        
    } catch (error) {
        console.log('Non-critical error in safe user check:', error.message);
        updateUIForUnauthenticated();
    }
}

function updateUIForAuthenticated(user) {
    console.log('User is authenticated:', user);
    const userInfo = document.getElementById('userInfo');
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (userInfo) {
        userInfo.style.display = 'block';
        document.getElementById('userEmail').textContent = user.email || 'No email';
        document.getElementById('userAddress').textContent = user.user_metadata?.wallet_address || 'No wallet address';
        document.getElementById('userId').textContent = user.id;
    }
    
    if (signInBtn) signInBtn.style.display = 'none';
    if (signOutBtn) signOutBtn.style.display = 'block';
}

function updateUIForUnauthenticated() {
    console.log('User is not authenticated');
    const userInfo = document.getElementById('userInfo');
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (userInfo) userInfo.style.display = 'none';
    if (signInBtn) signInBtn.style.display = 'block';
    if (signOutBtn) signOutBtn.style.display = 'none';
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