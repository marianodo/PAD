"""
Script to export data from local database to SQL file
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import get_db
from app.models.admin import Admin
from app.models.client import Client
from app.models.survey import Survey, Question, QuestionOption
from app.models.response import SurveyResponse, Answer
from app.models.user import User
from app.models.points import UserPoints, PointTransaction


def export_insert_statements():
    """Generate INSERT statements for all data"""
    
    db = next(get_db())
    
    print("-- Exported data from local database")
    print("-- Run this on Railway PostgreSQL")
    print()
    
    try:
        # Export Admins
        admins = db.query(Admin).all()
        if admins:
            print("-- Admins")
            for admin in admins:
                print(f"INSERT INTO admins (id, email, hashed_password, name, created_at) VALUES ('{admin.id}', '{admin.email}', '{admin.hashed_password}', '{admin.name}', '{admin.created_at}') ON CONFLICT (id) DO NOTHING;")
            print()
        
        # Export Clients
        clients = db.query(Client).all()
        if clients:
            print("-- Clients")
            for client in clients:
                print(f"INSERT INTO clients (id, email, hashed_password, name, cuit, phone, contact_person, contact_position, address, city, postal_code, website, description, created_at) VALUES ('{client.id}', '{client.email}', '{client.hashed_password}', '{client.name}', '{client.cuit}', {f"'{client.phone}'" if client.phone else 'NULL'}, {f"'{client.contact_person}'" if client.contact_person else 'NULL'}, {f"'{client.contact_position}'" if client.contact_position else 'NULL'}, {f"'{client.address}'" if client.address else 'NULL'}, {f"'{client.city}'" if client.city else 'NULL'}, {f"'{client.postal_code}'" if client.postal_code else 'NULL'}, {f"'{client.website}'" if client.website else 'NULL'}, {f"'{client.description}'" if client.description else 'NULL'}, '{client.created_at}') ON CONFLICT (id) DO NOTHING;")
            print()
        
        # Export Users
        users = db.query(User).all()
        if users:
            print("-- Users")
            for user in users:
                print(f"INSERT INTO users (id, cuil, email, hashed_password, name, phone, birth_date, address, neighborhood, city, postal_code, created_at) VALUES ('{user.id}', '{user.cuil}', '{user.email}', '{user.hashed_password}', {f"'{user.name}'" if user.name else 'NULL'}, {f"'{user.phone}'" if user.phone else 'NULL'}, {f"'{user.birth_date}'" if user.birth_date else 'NULL'}, {f"'{user.address}'" if user.address else 'NULL'}, {f"'{user.neighborhood}'" if user.neighborhood else 'NULL'}, {f"'{user.city}'" if user.city else 'NULL'}, {f"'{user.postal_code}'" if user.postal_code else 'NULL'}, '{user.created_at}') ON CONFLICT (id) DO NOTHING;")
            print()
        
        # Export Surveys
        surveys = db.query(Survey).all()
        if surveys:
            print("-- Surveys")
            for survey in surveys:
                print(f"INSERT INTO surveys (id, title, description, status, is_active, client_id, points_per_question, bonus_points, max_responses_per_user, created_at, expires_at) VALUES ('{survey.id}', '{survey.title}', {f"'{survey.description}'" if survey.description else 'NULL'}, '{survey.status}', {survey.is_active}, {f"'{survey.client_id}'" if survey.client_id else 'NULL'}, {survey.points_per_question}, {survey.bonus_points}, {survey.max_responses_per_user}, '{survey.created_at}', {f"'{survey.expires_at}'" if survey.expires_at else 'NULL'}) ON CONFLICT (id) DO NOTHING;")
            print()
        
        print("-- Export completed!")
        
    except Exception as e:
        print(f"-- Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    export_insert_statements()
