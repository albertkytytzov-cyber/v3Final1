package com.perform.training;

import android.app.Activity;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.TextView;

public class HealthConnectPermissionRationaleActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        TextView textView = new TextView(this);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        textView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        textView.setPadding(padding, padding, padding, padding);
        textView.setTextSize(18);
        textView.setText(
            "PERFORM читает из Health Connect только данные, нужные для тренерского разбора дня: сон, пульс покоя, пульс и тренировки. " +
            "Данные используются в карточке дня спортсмена и ИИ-разборе. PERFORM не меняет данные в Health Connect и не передает токены или учетные данные Xiaomi."
        );

        setContentView(textView);
    }
}
