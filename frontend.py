import streamlit as st
import requests
import tempfile

# Streamlit page setup
st.markdown("<style>" + open("style.css").read() + "</style>", unsafe_allow_html=True)
st.set_page_config(page_title="Jain Product Checker", page_icon="🪔", layout="wide")

# Center layout
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    st.title("🪔 Jain Product Checker")
    st.write("Upload or take a picture to check if it's Jain-friendly.")

    # Input selection
    option = st.radio(
        "Choose an option:", ["Upload from device", "Take a picture"], horizontal=True
    )

    image_data = None
    if option == "Upload from device":
        uploaded_file = st.file_uploader(
            "Upload an image", type=["png", "jpg", "jpeg", "webp"]
        )
        if uploaded_file:
            st.image(uploaded_file, caption="Uploaded Image", use_container_width=True)
            image_data = uploaded_file
    elif option == "Take a picture":
        camera_photo = st.camera_input("Take a picture")
        if camera_photo:
            st.image(camera_photo, caption="Captured Image", use_container_width=True)
            image_data = camera_photo

    # When image uploaded or captured
    if image_data:
        with st.spinner("Analyzing image..."):
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp.write(image_data.getbuffer())
                tmp_path = tmp.name

            try:
                files = {"image": open(tmp_path, "rb")}
                response = requests.post("http://127.0.0.1:8000/is_jain", files=files)

                if response.status_code == 200:
                    data = response.json()
                    st.success("✅ Analysis complete!")

                    # --- Non-Jain Ingredients ---
                    non_jain = data.get("non_jain_ingredients", [])
                    if non_jain:
                        st.markdown("### ❌ Non-Jain Ingredients")
                        for item in non_jain:
                            st.markdown(
                                f"""
                                <div style="
                                    background-color:#ffe6e6;
                                    padding:12px 16px;
                                    border-radius:12px;
                                    margin-bottom:8px;
                                    box-shadow:0 1px 4px rgba(0,0,0,0.1);
                                ">
                                    <b>❌ {item['name']}</b><br>
                                    <small style="color:#555;">{item['reason']}</small>
                                </div>
                            """,
                                unsafe_allow_html=True,
                            )

                    # --- Uncertain Ingredients ---
                    uncertain = data.get("uncertain_ingredients", [])
                    if uncertain:
                        st.markdown("### ⚠️ Uncertain Ingredients")
                        for item in uncertain:
                            st.markdown(
                                f"""
                                <div style="
                                    background-color:#fff7e6;
                                    padding:12px 16px;
                                    border-radius:12px;
                                    margin-bottom:8px;
                                    box-shadow:0 1px 4px rgba(0,0,0,0.1);
                                ">
                                    <b>⚠️ {item['name']}</b><br>
                                    <small style="color:#555;">{item['reason']}</small>
                                </div>
                            """,
                                unsafe_allow_html=True,
                            )

                    # --- Jain Ingredients ---
                    jain = data.get("jain_ingredients", [])
                    if jain:
                        st.markdown("### ✅ Jain Ingredients")
                        for item in jain:
                            st.markdown(
                                f"""
                                <div style="
                                    background-color:#e6ffe6;
                                    padding:12px 16px;
                                    border-radius:12px;
                                    margin-bottom:8px;
                                    box-shadow:0 1px 4px rgba(0,0,0,0.1);
                                ">
                                    <b>✅ {item['name']}</b>
                                </div>
                            """,
                                unsafe_allow_html=True,
                            )

                    # --- Summary Section ---
                    summary = data.get("summary", {})
                    if summary:
                        st.markdown("---")
                        note = summary.get("note", "")

                        st.markdown(
                            f"""
                            <div style="
                                background-color:#ffffff;
                                padding:16px;
                                border-radius:12px;
                                margin-top:20px;
                                box-shadow:0 1px 4px rgba(0,0,0,0.1);
                            ">
                                <h4>Summary</h4>
                                <p style="margin:0;">{note}</p>
                            </div>
                        """,
                            unsafe_allow_html=True,
                        )

                else:
                    st.error(f"❌ Error: {response.status_code} - {response.text}")

            except Exception as e:
                st.error(f"⚠️ Failed to connect to the API: {e}")
