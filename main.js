import { createClient } from '@supabase/supabase-js'

// Get credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test function to load data
async function loadData() {
    try {
        const { data, error } = await supabase
            .from('your_table_name')  // Replace with your table name
            .select('*')
            .limit(5)

        if (error) {
            console.error('Error:', error)
            document.getElementById('content').innerHTML = 
                `<p style="color: red;">Error: ${error.message}</p>`
            return
        }

        console.log('Data loaded:', data)
        document.getElementById('content').innerHTML = 
            `<pre>${JSON.stringify(data, null, 2)}</pre>`
            
    } catch (err) {
        console.error('Unexpected error:', err)
    }
}

// Make function available globally for the button click
window.loadData = loadData

// Optional: Load data automatically when page loads
// document.addEventListener('DOMContentLoaded', loadData)