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
        // Create Supabase client with web3-friendly configuration
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });

        console.log('Supabase client created successfully');
        
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
    
    const signInSolanaBtn = document.getElementById('signInSolanaBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (signInSolanaBtn) {
        signInSolanaBtn.addEventListener('click', signInWithSolana);
        signInSolanaBtn.style.display = 'block';
        console.log('Solana sign in button listener added');
    }
    
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
        console.log('Sign out button listener added');
    }
    
    // Check user status with a safer approach
    checkUserSafely();
}

async function signInWithSolana() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        
        hideError();
        setLoading(true, document.getElementById('signInSolanaBtn'));

        console.log('Initiating Solana connection...');
        
        // Check for Phantom wallet with timeout
        const provider = await detectPhantomWallet(5000);
        
        if (!provider) {
            throw new Error('Phantom wallet not detected. Please install Phantom wallet and try again.');
        }

        console.log('Phantom wallet detected, connecting...');
        
        // Use the recommended connection approach from Phantom docs
        let connectionResponse;
        try {
            // Method 1: Try the recommended connect() approach first
            connectionResponse = await provider.connect();
            console.log('Phantom connection successful:', connectionResponse);
        } catch (connectError) {
            console.log('First connection attempt failed, trying alternative...', connectError);
            
            // Method 2: Try the request() method as fallback
            try {
                connectionResponse = await provider.request({ method: "connect" });
                console.log('Alternative connection successful:', connectionResponse);
            } catch (requestError) {
                console.log('Alternative connection also failed:', requestError);
                throw new Error(`Connection failed: ${requestError.message || 'User rejected the request'}`);
            }
        }

        // Verify we have a public key
        if (!provider.publicKey) {
            throw new Error('Connected but no public key received');
        }

        console.log('Phantom wallet connected successfully');
        console.log('Public key:', provider.publicKey.toString());
        console.log('Is connected:', provider.isConnected);

        // Use Supabase's signInWithWeb3 method for Solana
        console.log('Starting Supabase web3 authentication...');
        const { data, error } = await supabaseClient.auth.signInWithWeb3({
            chain: 'solana',
            provider: provider,
            options: {
                statement: 'Sign in to the application'
            }
        });

        if (error) {
            throw error;
        }

        console.log('Solana sign-in successful:', data);
        
        // Check user after successful sign-in
        setTimeout(() => {
            checkUserSafely();
        }, 1000);
        
    } catch (error) {
        console.error('Solana sign-in error:', error);
        
        // Enhanced error handling
        if (error.code === 4001 || 
            error.message?.includes('rejected') || 
            error.message?.includes('canceled') ||
            error.message?.includes('User rejected')) {
            showError('Solana sign-in was cancelled or rejected by user');
        } else if (error.message?.includes('timeout')) {
            showError('Wallet connection timeout. Please try again.');
        } else if (error.message?.includes('not found') || error.message?.includes('unavailable')) {
            showError('Phantom wallet not found. Please install Phantom wallet.');
        } else if (error.message?.includes('public key')) {
            showError('Connected to wallet but could not retrieve public key.');
        } else {
            showError(error.message || 'Solana sign-in failed. Please try again.');
        }
    } finally {
        setLoading(false, document.getElementById('signInSolanaBtn'));
    }
}

// Improved Phantom wallet detection with timeout
function detectPhantomWallet(timeout = 5000) {
    return new Promise((resolve) => {
        console.log('Detecting Phantom wallet...');
        
        // Immediate check
        const provider = getPhantomProvider();
        if (provider) {
            console.log('Phantom wallet found immediately');
            resolve(provider);
            return;
        }

        // If not found immediately, wait for it to load
        let timeoutId;
        const checkInterval = setInterval(() => {
            const foundProvider = getPhantomProvider();
            if (foundProvider) {
                clearInterval(checkInterval);
                clearTimeout(timeoutId);
                console.log('Phantom wallet found after waiting');
                resolve(foundProvider);
            }
        }, 100);

        // Timeout if wallet not detected
        timeoutId = setTimeout(() => {
            clearInterval(checkInterval);
            console.log('Phantom wallet detection timeout');
            resolve(null);
        }, timeout);
    });
}

// Helper function to get Phantom provider
function getPhantomProvider() {
    // Check various possible locations for Phantom
    if (window.phantom?.solana?.isPhantom) {
        return window.phantom.solana;
    }
    if (window.solana?.isPhantom) {
        return window.solana;
    }
    if (window.phantom?.solana) {
        return window.phantom.solana;
    }
    if (window.solana) {
        return window.solana;
    }
    return null;
}

// Alternative sign-in method if the main one fails
async function signInWithSolanaAlternative() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        
        hideError();
        setLoading(true, document.getElementById('signInSolanaBtn'));

        console.log('Trying alternative Solana connection...');
        
        // Direct Phantom detection without timeout
        const provider = getPhantomProvider();
        if (!provider) {
            throw new Error('Phantom wallet not detected');
        }

        console.log('Attempting direct connection...');
        
        // Try direct connection without options
        await provider.connect();
        
        console.log('Direct connection successful, public key:', provider.publicKey?.toString());

        // Try alternative Supabase auth approach
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'solana',
            options: {
                skipBrowserRedirect: true,
                queryParams: {
                    provider: 'phantom'
                }
            }
        });

        if (error) throw error;

        console.log('Alternative sign-in successful:', data);
        setTimeout(() => checkUserSafely(), 1000);
        
    } catch (error) {
        console.error('Alternative sign-in failed:', error);
        showError('Authentication failed: ' + error.message);
    } finally {
        setLoading(false, document.getElementById('signInSolanaBtn'));
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
        
        // Also disconnect from Phantom wallet if connected
        const provider = getPhantomProvider();
        if (provider && provider.isConnected) {
            try {
                await provider.disconnect();
                console.log('Disconnected from Phantom wallet');
            } catch (disconnectError) {
                console.warn('Could not disconnect from Phantom wallet:', disconnectError);
            }
        }
        
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
        
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.log('Session check error (non-critical):', sessionError.message);
            updateUIForUnauthenticated();
            return;
        }
        
        if (session) {
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
        
        updateUIForUnauthenticated();
        
    } catch (error) {
        console.log('Non-critical error in safe user check:', error.message);
        updateUIForUnauthenticated();
    }
}

function updateUIForAuthenticated(user) {
    console.log('User is authenticated:', user);
    const userInfo = document.getElementById('userInfo');
    const signInSolanaBtn = document.getElementById('signInSolanaBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (userInfo) {
        userInfo.style.display = 'block';
        document.getElementById('userEmail').textContent = user.email || 'No email';
        
        const walletAddress = user.user_metadata?.wallet_address || 
                            user.app_metadata?.provider_id || 
                            user.user_metadata?.public_key ||
                            'No wallet address';
        document.getElementById('userAddress').textContent = walletAddress;
        document.getElementById('userId').textContent = user.id;
    }
    
    if (signInSolanaBtn) signInSolanaBtn.style.display = 'none';
    if (signOutBtn) signOutBtn.style.display = 'block';
}

function updateUIForUnauthenticated() {
    console.log('User is not authenticated');
    const userInfo = document.getElementById('userInfo');
    const signInSolanaBtn = document.getElementById('signInSolanaBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (userInfo) userInfo.style.display = 'none';
    if (signInSolanaBtn) signInSolanaBtn.style.display = 'block';
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
        
        setTimeout(() => hideError(), 5000);
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
            button.textContent = 'Connecting...';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            button.textContent = 'Sign in with Solana';
        }
    }
}

// Add styles for loading state
const style = document.createElement('style');
style.textContent = `
    button.loading {
        opacity: 0.7;
        cursor: not-allowed;
    }
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);

// Debug function to check what's available
function debugWalletDetection() {
    console.log('=== Wallet Detection Debug ===');
    console.log('window.phantom:', window.phantom);
    console.log('window.solana:', window.solana);
    console.log('window.phantom?.solana:', window.phantom?.solana);
    console.log('getPhantomProvider():', getPhantomProvider());
    console.log('=============================');
}

// Initialize the app
window.addEventListener('load', () => {
    console.log('Window loaded, initializing app...');
    debugWalletDetection(); // Debug info
    initializeApp();
});

if (document.readyState === 'complete') {
    console.log('Document already complete, initializing app...');
    debugWalletDetection(); // Debug info
    initializeApp();
}