Poryecto geoportal 

# Entorno virtual
python -m venv venv

# intstalar depedencias 
pip install -r requirements.txt

#Arrancar el servidor de fastapi
uvicorn main:app --reload
