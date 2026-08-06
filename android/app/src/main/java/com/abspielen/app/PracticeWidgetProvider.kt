package com.abspielen.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews

class PracticeWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_REVEAL = "com.abspielen.app.ACTION_REVEAL"
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (ACTION_REVEAL == intent.action) {
            val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                // Reveal the answer for this widget
                val prefs: SharedPreferences = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                val targetText = prefs.getString("widget_card_target", "No answer found.")

                val views = RemoteViews(context.packageName, R.layout.widget_practice)
                views.setTextViewText(R.id.widget_source_text, targetText)
                views.setTextViewText(R.id.widget_action_btn, "Open app to continue")

                // Now, clicking it should open the app
                val openIntent = Intent(context, MainActivity::class.java).apply {
                    action = "com.abspielen.app.PRACTICE"
                }
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    appWidgetId,
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_action_btn, pendingIntent)
                views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

                AppWidgetManager.getInstance(context).updateAppWidget(appWidgetId, views)
            }
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            // Setup the reveal intent for the button
            val revealIntent = Intent(context, PracticeWidgetProvider::class.java).apply {
                action = ACTION_REVEAL
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            val revealPendingIntent = PendingIntent.getBroadcast(
                context,
                appWidgetId,
                revealIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Read from Capacitor Preferences
            val prefs: SharedPreferences = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            val sourceText = prefs.getString("widget_card_source", "Open app to start practice")
            val tag = prefs.getString("widget_card_tag", "")
            val progress = prefs.getString("widget_cards_progress", "")

            val views = RemoteViews(context.packageName, R.layout.widget_practice)
            views.setTextViewText(R.id.widget_source_text, sourceText)
            views.setTextViewText(R.id.widget_tag, tag)
            views.setTextViewText(R.id.widget_progress, progress)
            views.setTextViewText(R.id.widget_action_btn, "Show answer")

            views.setOnClickPendingIntent(R.id.widget_action_btn, revealPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_container, revealPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
