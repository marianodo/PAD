--
-- PostgreSQL database dump
--

\restrict v9qXRQ7q4rwWjIRgf10muIZdyelzmZHxpnF3AlRowpHW7308zLkwqM3BprJc8K1

-- Dumped from database version 15.4 (Debian 15.4-1.pgdg110+1)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: pad_user
--

CREATE SCHEMA tiger;


ALTER SCHEMA tiger OWNER TO pad_user;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: pad_user
--

CREATE SCHEMA tiger_data;


ALTER SCHEMA tiger_data OWNER TO pad_user;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: pad_user
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO pad_user;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: pad_user
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: questiontype; Type: TYPE; Schema: public; Owner: pad_user
--

CREATE TYPE public.questiontype AS ENUM (
    'MULTIPLE_CHOICE',
    'SINGLE_CHOICE',
    'PERCENTAGE_DISTRIBUTION',
    'RATING',
    'OPEN_TEXT'
);


ALTER TYPE public.questiontype OWNER TO pad_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.admins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admins OWNER TO pad_user;

--
-- Name: answers; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.answers (
    id uuid NOT NULL,
    response_id uuid NOT NULL,
    question_id uuid NOT NULL,
    option_id uuid,
    answer_text text,
    rating integer,
    percentage_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_rating CHECK (((rating IS NULL) OR ((rating >= 1) AND (rating <= 5))))
);


ALTER TABLE public.answers OWNER TO pad_user;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    cuit character varying(11),
    phone character varying(50),
    contact_person character varying(255),
    contact_position character varying(255),
    address text,
    city character varying(255),
    postal_code character varying(20),
    website character varying(255),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.clients OWNER TO pad_user;

--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.point_transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    transaction_type character varying(50) NOT NULL,
    amount integer NOT NULL,
    description text,
    related_response_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.point_transactions OWNER TO pad_user;

--
-- Name: question_options; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.question_options (
    id uuid NOT NULL,
    question_id uuid NOT NULL,
    option_text text NOT NULL,
    option_value character varying(255),
    order_index integer
);


ALTER TABLE public.question_options OWNER TO pad_user;

--
-- Name: questions; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.questions (
    id uuid NOT NULL,
    survey_id uuid NOT NULL,
    question_text text NOT NULL,
    question_type public.questiontype NOT NULL,
    order_index integer NOT NULL,
    is_required boolean,
    config jsonb
);


ALTER TABLE public.questions OWNER TO pad_user;

--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.survey_responses (
    id uuid NOT NULL,
    survey_id uuid NOT NULL,
    user_id uuid NOT NULL,
    completed boolean,
    points_earned integer,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    ip_address inet,
    user_agent text
);


ALTER TABLE public.survey_responses OWNER TO pad_user;

--
-- Name: surveys; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.surveys (
    id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50),
    points_per_question integer,
    bonus_points integer,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    max_responses_per_user integer DEFAULT 0,
    client_id uuid,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.surveys OWNER TO pad_user;

--
-- Name: user_points; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.user_points (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    total_points integer,
    available_points integer,
    redeemed_points integer,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_points OWNER TO pad_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: pad_user
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50),
    birth_date date,
    address character varying,
    neighborhood character varying(255),
    city character varying(255),
    postal_code character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cuil character varying(11) NOT NULL,
    hashed_password character varying(255) NOT NULL
);


ALTER TABLE public.users OWNER TO pad_user;

--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.admins (id, email, hashed_password, name, created_at, updated_at) FROM stdin;
8a4241d6-ccda-4e21-bad6-b72c1735019a	mardom4164@gmail.com	$2b$12$teRUu457qYJUReZsroSBrO2uPOk5iXjOB8xvXmQ2Jfwg1loPoykxK	Mariano Agustin Dominguez	2025-12-24 00:52:29.975293+00	2025-12-30 18:46:25.75532+00
\.


--
-- Data for Name: answers; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.answers (id, response_id, question_id, option_id, answer_text, rating, percentage_data, created_at) FROM stdin;
f701e220-bed1-456a-8499-97a76fce0212	6a751f5a-2534-4306-9616-429f5695492a	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	\N	\N	\N	{"f28ae3f5-718a-4f18-877e-77dc7a07dd0e": 100.0}	2025-12-26 14:07:17.769762+00
00834239-4847-436d-9229-33ae600ea557	6a751f5a-2534-4306-9616-429f5695492a	083d425a-bbd2-4846-8207-3c0ee714348d	69ab6b3f-f7d2-4faa-a4e5-ad6f39196127	\N	\N	null	2025-12-26 14:07:17.769762+00
eb011fe5-c248-48fc-8a05-0f7c9782bf8a	6a751f5a-2534-4306-9616-429f5695492a	0720f04e-e0a4-4920-a267-b0fbf12706b6	\N	\N	3	null	2025-12-26 14:07:17.769762+00
3e90a112-0150-4817-929a-a99aa94fc8d2	8c0562f0-2051-4a9d-b0ef-9f531f0aa647	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	\N	\N	\N	{"4e4dd366-eeea-48e9-8425-6c88fc90b595": 42.0, "a1ece054-d502-4b58-bf16-8bc6a03c9e5c": 58.0}	2025-12-27 16:48:27.517474+00
fb965225-1de8-4fd2-ab48-1b1e6e5f5af4	8c0562f0-2051-4a9d-b0ef-9f531f0aa647	083d425a-bbd2-4846-8207-3c0ee714348d	a0f5c1ef-68ab-4e43-9c11-2fdbb39ba8b4	\N	\N	null	2025-12-27 16:48:27.517474+00
d44a1d02-4930-46a8-93fb-7817fbed9f09	8c0562f0-2051-4a9d-b0ef-9f531f0aa647	0720f04e-e0a4-4920-a267-b0fbf12706b6	\N	\N	5	null	2025-12-27 16:48:27.517474+00
227fe2cc-0e2c-4cd5-9ce6-84425316b938	83da0fd4-6ace-4fed-a66e-93eb29c4b0f6	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	\N	\N	\N	{"4e4dd366-eeea-48e9-8425-6c88fc90b595": 100.0}	2025-12-27 16:48:42.006393+00
e05c98ff-fa08-4ac0-b637-d67e6b5d0814	83da0fd4-6ace-4fed-a66e-93eb29c4b0f6	083d425a-bbd2-4846-8207-3c0ee714348d	0f306682-fc90-4246-84dd-fc7d49a76e03	\N	\N	null	2025-12-27 16:48:42.006393+00
7f31c7c5-361c-42ff-abcd-e2acde4f4399	83da0fd4-6ace-4fed-a66e-93eb29c4b0f6	0720f04e-e0a4-4920-a267-b0fbf12706b6	\N	\N	2	null	2025-12-27 16:48:42.006393+00
77d13441-8118-4359-b622-f4b078d394e8	39ed2829-34c4-4589-a8ae-f522b1d7c766	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	\N	\N	\N	{"4e4dd366-eeea-48e9-8425-6c88fc90b595": 11.0, "88a1aa63-025e-4a86-a691-323bbeedc741": 34.0, "a1ece054-d502-4b58-bf16-8bc6a03c9e5c": 13.0, "f28ae3f5-718a-4f18-877e-77dc7a07dd0e": 42.0}	2025-12-27 23:00:11.124089+00
0d19ecae-45c4-4f1b-b2d3-aefc94b34f0f	39ed2829-34c4-4589-a8ae-f522b1d7c766	083d425a-bbd2-4846-8207-3c0ee714348d	69ab6b3f-f7d2-4faa-a4e5-ad6f39196127	\N	\N	null	2025-12-27 23:00:11.124089+00
6b51e947-8011-4ad6-b72e-334d4fdea59c	39ed2829-34c4-4589-a8ae-f522b1d7c766	0720f04e-e0a4-4920-a267-b0fbf12706b6	\N	\N	5	null	2025-12-27 23:00:11.124089+00
b0daedc1-ebca-4e61-96be-5f4ca1bcab6c	466cb28f-ebc6-4aa8-85b3-8a4b7d5c6e89	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	\N	\N	\N	{"2f9667c7-03cf-4520-86d3-713a65445ed1": 14.0, "a1ece054-d502-4b58-bf16-8bc6a03c9e5c": 40.0, "f28ae3f5-718a-4f18-877e-77dc7a07dd0e": 46.0}	2025-12-29 17:29:21.982777+00
32228f3b-3c37-4fe6-94ff-559d076152ce	466cb28f-ebc6-4aa8-85b3-8a4b7d5c6e89	083d425a-bbd2-4846-8207-3c0ee714348d	a0f5c1ef-68ab-4e43-9c11-2fdbb39ba8b4	\N	\N	null	2025-12-29 17:29:21.982777+00
e14e03af-023c-4528-9bbf-59a9ccbeda5c	466cb28f-ebc6-4aa8-85b3-8a4b7d5c6e89	0720f04e-e0a4-4920-a267-b0fbf12706b6	\N	\N	5	null	2025-12-29 17:29:21.982777+00
316f0f8b-1226-40f5-a066-2f3dfa9e8e16	efd36d1f-a18b-4c56-97d6-81bb5b4a7d10	847ac448-a382-4eb9-9273-72d11571391b	\N	\N	\N	{"8971c09c-fac6-49d7-b55a-7de0b64c7bd6": 100.0}	2025-12-29 17:32:16.156885+00
89dc9590-d0c2-4e00-9a1c-1641478d9ab7	efd36d1f-a18b-4c56-97d6-81bb5b4a7d10	c470d13c-da97-4cf8-b1ae-0d7f778a1748	2ead452b-8d66-4b8b-89fb-3cad21e60e4f	\N	\N	null	2025-12-29 17:32:16.156885+00
41af774c-24b9-406b-8cc4-e3b3aec757e8	efd36d1f-a18b-4c56-97d6-81bb5b4a7d10	a7544106-4591-49f4-ad05-f4fad02efbc6	\N	\N	5	null	2025-12-29 17:32:16.156885+00
7023fda6-3fc2-486e-b6ed-990c77cccba2	92082c6f-b5a8-45ea-891b-ae84983bcdb7	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	\N	\N	\N	{"2f9667c7-03cf-4520-86d3-713a65445ed1": 29.0, "88a1aa63-025e-4a86-a691-323bbeedc741": 35.0, "f28ae3f5-718a-4f18-877e-77dc7a07dd0e": 36.0}	2025-12-30 13:39:58.360511+00
f383cdff-e753-4d55-92d4-91b856f5f497	92082c6f-b5a8-45ea-891b-ae84983bcdb7	083d425a-bbd2-4846-8207-3c0ee714348d	a0f5c1ef-68ab-4e43-9c11-2fdbb39ba8b4	\N	\N	null	2025-12-30 13:39:58.360511+00
6ed3278e-35ec-48ed-999b-a090cb63c54a	92082c6f-b5a8-45ea-891b-ae84983bcdb7	0720f04e-e0a4-4920-a267-b0fbf12706b6	\N	\N	2	null	2025-12-30 13:39:58.360511+00
962a5fda-87ab-4618-aeaa-b44338b37d5e	e67cfbc7-2d89-4a2a-9ff2-76facac58b35	847ac448-a382-4eb9-9273-72d11571391b	\N	\N	\N	{"4d7f9658-ffef-4eab-802d-5f5f80f8c821": 46.0, "743e9024-9c0d-47cc-92c6-135f5ed2d17c": 36.0, "8971c09c-fac6-49d7-b55a-7de0b64c7bd6": 18.0}	2025-12-30 18:46:56.286415+00
89c7ac42-e6f1-48eb-9577-ea7f10ab7c0d	e67cfbc7-2d89-4a2a-9ff2-76facac58b35	c470d13c-da97-4cf8-b1ae-0d7f778a1748	2ead452b-8d66-4b8b-89fb-3cad21e60e4f	\N	\N	null	2025-12-30 18:46:56.286415+00
a15988e3-7e88-447f-8d97-13b044b55cbb	e67cfbc7-2d89-4a2a-9ff2-76facac58b35	a7544106-4591-49f4-ad05-f4fad02efbc6	\N	\N	5	null	2025-12-30 18:46:56.286415+00
2ae8e4bc-14f7-4f3a-aacc-7eef322481e9	d8be8f00-1692-41a8-ada3-73662214dd8d	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	\N	\N	\N	{"2f9667c7-03cf-4520-86d3-713a65445ed1": 19.0, "88a1aa63-025e-4a86-a691-323bbeedc741": 24.0, "a1ece054-d502-4b58-bf16-8bc6a03c9e5c": 39.0, "f28ae3f5-718a-4f18-877e-77dc7a07dd0e": 18.0}	2025-12-30 20:20:31.91526+00
94754b19-f6cf-4746-a812-014800ea8720	d8be8f00-1692-41a8-ada3-73662214dd8d	083d425a-bbd2-4846-8207-3c0ee714348d	0f306682-fc90-4246-84dd-fc7d49a76e03	\N	\N	null	2025-12-30 20:20:31.91526+00
9de01a13-1caa-4c77-921b-19da1ef84e9a	d8be8f00-1692-41a8-ada3-73662214dd8d	0720f04e-e0a4-4920-a267-b0fbf12706b6	\N	\N	5	null	2025-12-30 20:20:31.91526+00
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.clients (id, email, hashed_password, name, cuit, phone, contact_person, contact_position, address, city, postal_code, website, description, created_at, updated_at) FROM stdin;
7a8549a6-6072-429d-99ce-58a52b3b4ee4	muni.altagracia@gmail.com	$2b$12$FKenQi5hdr3tYYtsrIoB3eLjv/NxmlD/2L6tV4XM/6In0yLZuuWdm	Municipalidad de Alta Gracia	30123456789	0351-4123456	\N	\N	Av. Sarmiento 1	Alta Gracia	5186	\N	\N	2025-12-30 19:03:44.808904+00	2025-12-30 19:03:44.808904+00
\.


--
-- Data for Name: point_transactions; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.point_transactions (id, user_id, transaction_type, amount, description, related_response_id, created_at) FROM stdin;
334b918e-403d-401f-8669-ae407b351804	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	6a751f5a-2534-4306-9616-429f5695492a	2025-12-26 14:07:17.769762+00
a5bf2945-0760-4817-b812-08934d2aaf9f	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	8c0562f0-2051-4a9d-b0ef-9f531f0aa647	2025-12-27 16:48:27.517474+00
02bdc640-c5bc-41a9-b9a8-a55d772b8606	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	83da0fd4-6ace-4fed-a66e-93eb29c4b0f6	2025-12-27 16:48:42.006393+00
54ac479e-4adb-4a1f-bf69-2d2b472b736e	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	39ed2829-34c4-4589-a8ae-f522b1d7c766	2025-12-27 23:00:11.124089+00
551610d5-40fd-42d1-9d48-3b25009ecc2b	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	466cb28f-ebc6-4aa8-85b3-8a4b7d5c6e89	2025-12-29 17:29:21.982777+00
26680902-17aa-43db-b521-466e4d6b11de	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	efd36d1f-a18b-4c56-97d6-81bb5b4a7d10	2025-12-29 17:32:16.156885+00
ca5da2aa-1c0d-4cc4-84c5-db3d4a506366	0ea3fca4-56b9-4755-916c-61dbc206cae4	earned	80	Encuesta completada	92082c6f-b5a8-45ea-891b-ae84983bcdb7	2025-12-30 13:39:58.360511+00
80c7089c-d489-4eb6-8ace-429106c2b1bf	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	e67cfbc7-2d89-4a2a-9ff2-76facac58b35	2025-12-30 18:46:56.286415+00
302a4b9a-4b27-4f9b-9014-962920503f7e	8a4241d6-ccda-4e21-bad6-b72c1735019a	earned	80	Encuesta completada	d8be8f00-1692-41a8-ada3-73662214dd8d	2025-12-30 20:20:31.91526+00
\.


--
-- Data for Name: question_options; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.question_options (id, question_id, option_text, option_value, order_index) FROM stdin;
f28ae3f5-718a-4f18-877e-77dc7a07dd0e	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	INFRAESTRUCTURA MUNICIPAL	infraestructura	1
a1ece054-d502-4b58-bf16-8bc6a03c9e5c	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	SERVICIOS PÚBLICOS MUNICIPALES	servicios	2
4e4dd366-eeea-48e9-8425-6c88fc90b595	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	SEGURIDAD	seguridad	3
88a1aa63-025e-4a86-a691-323bbeedc741	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	SALUD PÚBLICA MUNICIPAL	salud	4
2f9667c7-03cf-4520-86d3-713a65445ed1	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	AYUDA SOCIAL	ayuda_social	5
f0198ad0-7f6d-410d-b8eb-d9fc03baf194	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	DEPORTES, CULTURA Y TURISMO	deportes_cultura	6
82b84ac1-dc07-466e-8ef9-d9241ea35027	b2955234-ae19-4979-bfb4-1cbd8b96b8f5	ESPACIOS PÚBLICOS	espacios_publicos	7
69ab6b3f-f7d2-4faa-a4e5-ad6f39196127	083d425a-bbd2-4846-8207-3c0ee714348d	CENTRO CÍVICO MUNICIPAL (Colonia Santa Fe)	centro_civico	1
a0f5c1ef-68ab-4e43-9c11-2fdbb39ba8b4	083d425a-bbd2-4846-8207-3c0ee714348d	PARQUE PÚBLICO (Potrero de Loyola)	parque_publico	2
0f306682-fc90-4246-84dd-fc7d49a76e03	083d425a-bbd2-4846-8207-3c0ee714348d	CENTRO DE CONVENCIONES (Ex Casino Sierras Hotel)	centro_convenciones	3
4d7f9658-ffef-4eab-802d-5f5f80f8c821	847ac448-a382-4eb9-9273-72d11571391b	INFRAESTRUCTURA MUNICIPAL	infraestructura	1
f9258e4e-9301-4c14-9830-8503bcea0bc6	847ac448-a382-4eb9-9273-72d11571391b	SERVICIOS PÚBLICOS MUNICIPALES	servicios	2
148b950d-49a0-4653-8058-6ce58b10a304	847ac448-a382-4eb9-9273-72d11571391b	SEGURIDAD	seguridad	3
743e9024-9c0d-47cc-92c6-135f5ed2d17c	847ac448-a382-4eb9-9273-72d11571391b	SALUD PÚBLICA MUNICIPAL	salud	4
519023ca-344a-42dd-8b9f-2c105ef6f3db	847ac448-a382-4eb9-9273-72d11571391b	AYUDA SOCIAL	ayuda_social	5
bca789b0-2005-4cdd-9105-e7687f81b425	847ac448-a382-4eb9-9273-72d11571391b	DEPORTES, CULTURA Y TURISMO	deportes_cultura	6
8971c09c-fac6-49d7-b55a-7de0b64c7bd6	847ac448-a382-4eb9-9273-72d11571391b	ESPACIOS PÚBLICOS	espacios_publicos	7
4aa3d76a-a7b9-434f-a38b-946f00681f9d	c470d13c-da97-4cf8-b1ae-0d7f778a1748	CENTRO CÍVICO MUNICIPAL (Colonia Santa Fe)	centro_civico	1
4730c3c1-0af7-4008-bd80-44dbf4941baa	c470d13c-da97-4cf8-b1ae-0d7f778a1748	PARQUE PÚBLICO (Potrero de Loyola)	parque_publico	2
2ead452b-8d66-4b8b-89fb-3cad21e60e4f	c470d13c-da97-4cf8-b1ae-0d7f778a1748	CENTRO DE CONVENCIONES (Ex Casino Sierras Hotel)	centro_convenciones	3
c62c6827-70d9-4372-80af-51d6ce462023	595d10e2-b076-47ca-8b5f-7ca4adc97321	Iluminación en calles y espacios públicos	iluminacion	1
3789669b-a70c-4a37-b83c-88489cdf53b4	595d10e2-b076-47ca-8b5f-7ca4adc97321	Mantenimiento de calles y veredas	calles_veredas	2
4200e0e3-0855-4655-858c-7483d0f0da77	595d10e2-b076-47ca-8b5f-7ca4adc97321	Espacios verdes y plazas	espacios_verdes	3
585a1227-5ba7-4e2c-8cc4-05a6841413ba	595d10e2-b076-47ca-8b5f-7ca4adc97321	Transporte público	transporte	4
96952283-3b4b-4e71-8570-22c2ee64e234	595d10e2-b076-47ca-8b5f-7ca4adc97321	Seguridad ciudadana	seguridad	5
42644263-11c9-49bc-85ca-27a0804f92d0	bd0e9ab5-40ee-4e9c-98dd-9da709b0dff9	EDUCACIÓN Y CAPACITACIÓN	educacion	1
60421953-e58d-4cd7-9d1b-bd234cdc2890	bd0e9ab5-40ee-4e9c-98dd-9da709b0dff9	MEDIO AMBIENTE Y SUSTENTABILIDAD	medio_ambiente	2
bcd83e36-2572-402e-a22b-3bbd37acad21	bd0e9ab5-40ee-4e9c-98dd-9da709b0dff9	ECONOMÍA LOCAL Y EMPLEO	economia	3
19ff8c61-d36e-4b50-96c9-d016bbfb9cf2	bd0e9ab5-40ee-4e9c-98dd-9da709b0dff9	CULTURA Y RECREACIÓN	cultura	4
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.questions (id, survey_id, question_text, question_type, order_index, is_required, config) FROM stdin;
b2955234-ae19-4979-bfb4-1cbd8b96b8f5	fa528601-f399-46ae-9fd9-65136ab08003	¿Dónde te gustaría invertir tu dinero?	PERCENTAGE_DISTRIBUTION	1	t	{"must_sum_to": 100}
083d425a-bbd2-4846-8207-3c0ee714348d	fa528601-f399-46ae-9fd9-65136ab08003	¿Qué obra pública elegirías ejecutar con prioridad?	SINGLE_CHOICE	2	t	{}
0720f04e-e0a4-4920-a267-b0fbf12706b6	fa528601-f399-46ae-9fd9-65136ab08003	¿Cómo calificarías la gestión municipal?	RATING	3	t	{"max": 5, "min": 1}
847ac448-a382-4eb9-9273-72d11571391b	5a986dda-437e-40ae-a43e-3ad72ec54fb9	¿Dónde te gustaría invertir tu dinero?	PERCENTAGE_DISTRIBUTION	1	t	{"must_sum_to": 100}
c470d13c-da97-4cf8-b1ae-0d7f778a1748	5a986dda-437e-40ae-a43e-3ad72ec54fb9	¿Qué obra pública elegirías ejecutar con prioridad?	SINGLE_CHOICE	2	t	{}
a7544106-4591-49f4-ad05-f4fad02efbc6	5a986dda-437e-40ae-a43e-3ad72ec54fb9	¿Cómo calificarías la gestión municipal?	RATING	3	t	{"max": 5, "min": 1}
595d10e2-b076-47ca-8b5f-7ca4adc97321	4c2b8571-b7fb-4fda-9395-6297bfa3f181	¿Cuáles son tus prioridades para mejorar el barrio?	SINGLE_CHOICE	1	t	{}
bd0e9ab5-40ee-4e9c-98dd-9da709b0dff9	4c2b8571-b7fb-4fda-9395-6297bfa3f181	¿Cómo distribuirías el presupuesto en estas áreas prioritarias?	PERCENTAGE_DISTRIBUTION	2	t	{"must_sum_to": 100}
a3b9184e-56fc-4ed2-b71f-49ceeb3f9fc0	4c2b8571-b7fb-4fda-9395-6297bfa3f181	¿Qué tan satisfecho estás con los servicios municipales actuales?	RATING	3	t	{"max": 5, "min": 1}
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: survey_responses; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.survey_responses (id, survey_id, user_id, completed, points_earned, started_at, completed_at, ip_address, user_agent) FROM stdin;
6a751f5a-2534-4306-9616-429f5695492a	fa528601-f399-46ae-9fd9-65136ab08003	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-26 14:07:17.769762+00	2025-12-26 11:07:17.79839+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
8c0562f0-2051-4a9d-b0ef-9f531f0aa647	fa528601-f399-46ae-9fd9-65136ab08003	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-27 16:48:27.517474+00	2025-12-27 13:48:27.534372+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
83da0fd4-6ace-4fed-a66e-93eb29c4b0f6	fa528601-f399-46ae-9fd9-65136ab08003	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-27 16:48:42.006393+00	2025-12-27 13:48:42.0234+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
39ed2829-34c4-4589-a8ae-f522b1d7c766	fa528601-f399-46ae-9fd9-65136ab08003	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-27 23:00:11.124089+00	2025-12-27 20:00:11.143076+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
466cb28f-ebc6-4aa8-85b3-8a4b7d5c6e89	fa528601-f399-46ae-9fd9-65136ab08003	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-29 17:29:21.982777+00	2025-12-29 14:29:22.002746+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
efd36d1f-a18b-4c56-97d6-81bb5b4a7d10	5a986dda-437e-40ae-a43e-3ad72ec54fb9	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-29 17:32:16.156885+00	2025-12-29 14:32:16.17318+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
92082c6f-b5a8-45ea-891b-ae84983bcdb7	fa528601-f399-46ae-9fd9-65136ab08003	0ea3fca4-56b9-4755-916c-61dbc206cae4	t	80	2025-12-30 13:39:58.360511+00	2025-12-30 10:39:58.37015+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
e67cfbc7-2d89-4a2a-9ff2-76facac58b35	5a986dda-437e-40ae-a43e-3ad72ec54fb9	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-30 18:46:56.286415+00	2025-12-30 15:46:56.301359+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
d8be8f00-1692-41a8-ada3-73662214dd8d	fa528601-f399-46ae-9fd9-65136ab08003	8a4241d6-ccda-4e21-bad6-b72c1735019a	t	80	2025-12-30 20:20:31.91526+00	2025-12-30 17:20:31.934279+00	127.0.0.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36
\.


--
-- Data for Name: surveys; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.surveys (id, title, description, status, points_per_question, bonus_points, created_at, expires_at, max_responses_per_user, client_id, is_active) FROM stdin;
fa528601-f399-46ae-9fd9-65136ab08003	Tú Decides - Encuesta Municipal	Tu opinión es importante para la gestión municipal	active	10	50	2025-12-24 00:32:18.591877+00	2026-03-23 21:32:18.51228+00	0	7a8549a6-6072-429d-99ce-58a52b3b4ee4	t
4c2b8571-b7fb-4fda-9395-6297bfa3f181	Mejoremos Juntos - Plan de Desarrollo Local	Ayúdanos a definir las prioridades para el desarrollo de nuestra comunidad	active	10	50	2025-12-30 13:20:20.85319+00	2026-03-30 10:20:20.763821+00	0	7a8549a6-6072-429d-99ce-58a52b3b4ee4	t
5a986dda-437e-40ae-a43e-3ad72ec54fb9	Tú Decides - Encuesta Municipal	Tu opinión es importante para la gestión municipal	active	10	50	2025-12-24 00:42:49.735584+00	2026-03-23 21:42:49.65976+00	0	7a8549a6-6072-429d-99ce-58a52b3b4ee4	f
\.


--
-- Data for Name: user_points; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.user_points (id, user_id, total_points, available_points, redeemed_points, updated_at) FROM stdin;
e9c34524-101c-4199-b56f-93bb87e5852a	0ea3fca4-56b9-4755-916c-61dbc206cae4	80	80	0	2025-12-30 13:39:58.360511+00
a87f0884-6bd7-4905-a621-57f0a9d1a387	8a4241d6-ccda-4e21-bad6-b72c1735019a	640	640	0	2025-12-30 20:20:31.91526+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: pad_user
--

COPY public.users (id, email, name, phone, birth_date, address, neighborhood, city, postal_code, created_at, updated_at, cuil, hashed_password) FROM stdin;
0ea3fca4-56b9-4755-916c-61dbc206cae4	florlizondo87@gmail.com	Florencia Lizondo	3547598200	\N	Calle 12 Lote 30 Mza 20	Reserva Tajamar	Alta Gracia	5186	2025-12-30 13:36:43.144534+00	2025-12-30 13:36:43.144534+00	27334373784	$2b$12$L2sarKBUHGsyAdfslJyoP.HU9UpnKAk3IDVn79I6flsOfTWeQZ0Oy
8a4241d6-ccda-4e21-bad6-b72c1735019a	mardom41643@gmail.com	Mariano Agustin Dominguez	+543517157848	1990-01-20	Calle 12 Lote 30 Manzana 20	Reserva Tajamar plus	Alta Gracia	5186	2025-12-24 00:52:29.975293+00	2025-12-30 18:46:25.75532+00	20349087600	$2b$12$teRUu457qYJUReZsroSBrO2uPOk5iXjOB8xvXmQ2Jfwg1loPoykxK
\.


--
-- Data for Name: geocode_settings; Type: TABLE DATA; Schema: tiger; Owner: pad_user
--

COPY tiger.geocode_settings (name, setting, unit, category, short_desc) FROM stdin;
\.


--
-- Data for Name: pagc_gaz; Type: TABLE DATA; Schema: tiger; Owner: pad_user
--

COPY tiger.pagc_gaz (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_lex; Type: TABLE DATA; Schema: tiger; Owner: pad_user
--

COPY tiger.pagc_lex (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_rules; Type: TABLE DATA; Schema: tiger; Owner: pad_user
--

COPY tiger.pagc_rules (id, rule, is_custom) FROM stdin;
\.


--
-- Data for Name: topology; Type: TABLE DATA; Schema: topology; Owner: pad_user
--

COPY topology.topology (id, name, srid, "precision", hasz) FROM stdin;
\.


--
-- Data for Name: layer; Type: TABLE DATA; Schema: topology; Owner: pad_user
--

COPY topology.layer (topology_id, layer_id, schema_name, table_name, feature_column, feature_type, level, child_id) FROM stdin;
\.


--
-- Name: topology_id_seq; Type: SEQUENCE SET; Schema: topology; Owner: pad_user
--

SELECT pg_catalog.setval('topology.topology_id_seq', 1, false);


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (id);


--
-- Name: clients clients_cuit_key; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_cuit_key UNIQUE (cuit);


--
-- Name: clients clients_email_key; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_email_key UNIQUE (email);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: question_options question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (id);


--
-- Name: user_points user_points_user_id_key; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_user_id_key UNIQUE (user_id);


--
-- Name: users users_cuil_key; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_cuil_key UNIQUE (cuil);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_admins_email; Type: INDEX; Schema: public; Owner: pad_user
--

CREATE INDEX idx_admins_email ON public.admins USING btree (email);


--
-- Name: idx_clients_cuit; Type: INDEX; Schema: public; Owner: pad_user
--

CREATE INDEX idx_clients_cuit ON public.clients USING btree (cuit);


--
-- Name: idx_clients_email; Type: INDEX; Schema: public; Owner: pad_user
--

CREATE INDEX idx_clients_email ON public.clients USING btree (email);


--
-- Name: idx_surveys_client_id; Type: INDEX; Schema: public; Owner: pad_user
--

CREATE INDEX idx_surveys_client_id ON public.surveys USING btree (client_id);


--
-- Name: idx_users_cuil; Type: INDEX; Schema: public; Owner: pad_user
--

CREATE INDEX idx_users_cuil ON public.users USING btree (cuil);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: pad_user
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: answers answers_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.question_options(id);


--
-- Name: answers answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: answers answers_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON DELETE CASCADE;


--
-- Name: surveys fk_surveys_client_id; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT fk_surveys_client_id FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: point_transactions point_transactions_related_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_related_response_id_fkey FOREIGN KEY (related_response_id) REFERENCES public.survey_responses(id);


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: question_options question_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: questions questions_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id);


--
-- Name: survey_responses survey_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_points user_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pad_user
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict v9qXRQ7q4rwWjIRgf10muIZdyelzmZHxpnF3AlRowpHW7308zLkwqM3BprJc8K1

