import streamlit as st
import sqlite3
import pandas as pd
import plotly.express as px
import os
import time

# -----------------------------
# CONFIG
# -----------------------------
st.set_page_config(page_title="Aura AI Dashboard", layout="wide")

st.markdown("""
   <style>
      .main {background-color: #f5f7f9;} 
      .stMetric {background-color: #000000; padding: 15px; border-radius: 10px; box-shadow: 0px 2px 10px rgba(0,0,0,0.1);}     
   </style>
""", unsafe_allow_html=True)

st.title("🌊 Aura: Personal Flow Dashboard")
st.divider()

# -----------------------------
# DATABASE PATH (ROBUST)
# -----------------------------
BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'data', 'aura.db')

# -----------------------------
# LOAD DATA
# -----------------------------
def get_data():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query(
        "SELECT * FROM activity_logs ORDER BY timestamp DESC",
        conn
    )
    conn.close()
    return df

data = get_data()

# -----------------------------
# DASHBOARD
# -----------------------------
if not data.empty:

    # Convert timestamp
    data['timestamp'] = pd.to_datetime(
    data['timestamp'], 
    format='mixed', 
    errors='coerce'
)

    # -----------------------------
    # METRICS
    # -----------------------------
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Logs", len(data))

    with col2:
        current_app = data['app_name'].iloc[0]
        st.metric("Current App", current_app)

    with col3:
        most_used = data['app_name'].mode()[0]
        st.metric("Most Used App", most_used)

    with col4:
        st.metric("Status", "🟢 Active")

    st.write("###")

    # -----------------------------
    # FOCUS SCORE
    # -----------------------------
    focus_apps = ["Code", "VS Code", "PyCharm"]

    focus_count = data[data['app_name'].isin(focus_apps)].shape[0]
    focus_score = (focus_count / len(data)) * 100

    st.metric("🎯 Focus Score", f"{focus_score:.1f}%")

    st.write("###")

    # -----------------------------
    # CHARTS
    # -----------------------------
    left_chart, right_table = st.columns([2, 1])

    # Pie Chart
    with left_chart:
        st.write("### 🧩 Activity Distribution")

        fig = px.pie(
            data,
            names='app_name',
            hole=0.4,
            color_discrete_sequence=px.colors.sequential.RdBu
        )
        st.plotly_chart(fig, width='stretch')

    # Table
    with right_table:
        st.write("#### 🕒 Recent Activity")
        st.dataframe(
            data[['timestamp', 'app_name']].head(15),
            width='stretch'
        )

    # -----------------------------
    # ACTIVITY OVER TIME
    # -----------------------------
    st.write("### 📈 Activity Over Time")

    data['hour'] = data['timestamp'].dt.hour
    hourly = data.groupby('hour').size().reset_index(name='count')

    fig2 = px.line(
        hourly,
        x='hour',
        y='count',
        markers=True,
        title="Hourly Activity"
    )
    st.plotly_chart(fig2, width='stretch')

else:
    st.info("🌊 Aura is waiting for your activity... Start the tracker to begin sensing!")

# -----------------------------
# AUTO REFRESH
# -----------------------------
time.sleep(5)
st.rerun()