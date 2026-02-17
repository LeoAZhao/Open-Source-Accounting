# Building the Windows executable (PyInstaller)

Build a single-file Windows executable so others can run the accounting app without installing Python.

## Prerequisites

- Windows
- Python 3.10+ with pip
- Install dependencies: `pip install -r requirements.txt`
- Install PyInstaller: `pip install pyinstaller`

## Build command (Windows)

From the project root (folder containing `app.py`):

```cmd
pyinstaller --onefile --windowed --name "CraniaAccounting" app.py
```

PyInstaller will automatically include `database.py` and `models.py` because they are imported by `app.py`. You can add an initial empty DB to the bundle if you want:

```cmd
pyinstaller --onefile --windowed --name "CraniaAccounting" --add-data "accounting.db;." app.py
```

(If `accounting.db` does not exist yet, create an empty file or run the app once to create it, then re-run the build to include it.)

- `--onefile`: Single .exe (no folder of dependencies).
- `--windowed`: No console window (optional; remove if you want to see the "Open http://127.0.0.1:5000" message in a console).
- `--name "CraniaAccounting"`: Output exe name.
- `--add-data "accounting.db;."`: Include an initial empty DB in the bundle (optional). On first run the exe will create `accounting.db` next to itself if it doesn’t exist, so you can omit this if you prefer not to ship a DB.

If you add a `templates` or `static` folder later:

```cmd
pyinstaller --onefile --windowed --name "CraniaAccounting" --add-data "templates;templates" --add-data "static;static" app.py database.py models.py
```

## Where the database is stored

- **Development (running from source):**  
  `accounting.db` is created in the **project root** (same folder as `app.py`).

- **Packaged (.exe):**  
  `accounting.db` is created in the **folder containing the .exe** (e.g. `dist\accounting.db` if you run the exe from `dist\`).  
  This keeps the database writable and persistent; it is not stored inside the read-only bundle.

## After building

1. Run the exe from `dist\CraniaAccounting.exe` (or the path PyInstaller prints).
2. The app will open the default browser to `http://127.0.0.1:5000` (or print that URL if you built without `--windowed`).
3. Data is stored in `accounting.db` in the same folder as the exe. Restarting the exe keeps all data.

## Troubleshooting

- If the exe fails to start, try building **without** `--windowed` to see errors in the console.
- If "module not found" appears, add the missing module explicitly:  
  `pyinstaller ... --hidden-import flask_sqlalchemy ... app.py database.py models.py`
