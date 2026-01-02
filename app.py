import os
from flask import Flask, render_template

# Initialize the Flask app
# Flask automatically looks for 'templates' and 'static' folders
app = Flask(__name__)

@app.route('/')
def index():
    # This tells Flask to look into the 'templates' folder for index.html
    return render_template('index.html')

if __name__ == '__main__':
    # '0.0.0.0' is required for Render to make the app accessible externally
    # Render provides the PORT as an environment variable
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)