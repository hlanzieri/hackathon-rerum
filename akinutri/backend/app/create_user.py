import argparse
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError

from .auth import create_user
from .database import Base, SessionLocal, engine


def main():
    parser = argparse.ArgumentParser(description="Cria uma conta AkiNutri.")
    parser.add_argument("--email", required=True, help="E-mail da conta.")
    parser.add_argument("--name", required=True, help="Nome para exibição.")
    args = parser.parse_args()

    try:
        email = TypeAdapter(EmailStr).validate_python(args.email).strip().lower()
    except ValidationError as error:
        parser.error(f"E-mail inválido: {error.errors()[0]['msg']}")
    if not args.name.strip() or len(args.name.strip()) > 120:
        parser.error("O nome deve conter entre 1 e 120 caracteres.")

    password = getpass("Senha (mínimo de 8 caracteres): ")
    confirmation = getpass("Confirme a senha: ")
    if len(password) < 8:
        parser.error("A senha deve conter pelo menos 8 caracteres.")
    if len(password.encode("utf-8")) > 72:
        parser.error("A senha excede o limite de 72 bytes do bcrypt.")
    if password != confirmation:
        parser.error("As senhas não coincidem.")

    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        try:
            user = create_user(db, email, args.name, password)
        except ValueError as error:
            parser.error(str(error))
    print(f"Conta criada para {user.email}.")


if __name__ == "__main__":
    main()
