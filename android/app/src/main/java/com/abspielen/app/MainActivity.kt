package com.abspielen.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent != null && "com.abspielen.app.PRACTICE" == intent.action) {
            bridge?.eval("window.dispatchEvent(new CustomEvent('navigate', {detail: 'practice'}));", null)
            // Clear the action so it doesn't trigger again on normal resume without clicking the widget
            intent.action = null
            setIntent(intent)
        }
    }
}
