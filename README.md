# Python + Node.js Integration

An Express API gateway on port 3000 forwards calculations to a Flask worker on port 5001. The calculator UI is served by Express, and each request is appended to `nodejs-service/history.csv`.

## Run locally

In one terminal, create the local environment, install Flask, and start the Python worker from the workspace root:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r python-service/requirements.txt
.venv\Scripts\python.exe python-service/app.py
```

In a second terminal, install and start the Node.js gateway:

```powershell
cd nodejs-service
npm install
npm start
```

Open `http://localhost:3000` for the calculator. The REST Client examples are in `test.http`.

Set `PYTHON_SERVICE_URL` to point the gateway at a worker on another host. Set `PORT` to override the gateway port.