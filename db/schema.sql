SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    campaign_id integer NOT NULL,
    stripe_endpoint character varying,
    stripe_api_key character varying,
    coinbase_endpoint character varying,
    coinbase_api_key character varying,
    graph_endpoint character varying,
    graph_api_key character varying,
    contribution_total numeric NOT NULL,
    created timestamp without time zone DEFAULT now()
);


--
-- Name: campaigns_campaign_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaigns_campaign_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaigns_campaign_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaigns_campaign_id_seq OWNED BY public.campaigns.campaign_id;


--
-- Name: impact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impact (
    campaign_id integer NOT NULL,
    user_id integer NOT NULL,
    total_donated numeric,
    total_referred numeric,
    created timestamp without time zone DEFAULT now()
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    name text,
    email text,
    eth_address text,
    created timestamp without time zone DEFAULT now()
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: campaigns campaign_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN campaign_id SET DEFAULT nextval('public.campaigns_campaign_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id);


--
-- Name: impact impact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact
    ADD CONSTRAINT impact_pkey PRIMARY KEY (user_id, campaign_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_eth_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_eth_address_key UNIQUE (eth_address);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: campaigns_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaigns_campaign_id_idx ON public.campaigns USING btree (campaign_id);


--
-- Name: impact_total_donated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX impact_total_donated_idx ON public.impact USING btree (total_donated);


--
-- Name: users_email_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_trgm_idx ON public.users USING gin (email public.gin_trgm_ops);


--
-- Name: users_eth_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_eth_trgm_idx ON public.users USING gin (eth_address public.gin_trgm_ops);


--
-- Name: users_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_name_key ON public.users USING btree (name);


--
-- Name: users_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_name_trgm_idx ON public.users USING gin (name public.gin_trgm_ops);


--
-- Name: impact impact_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact
    ADD CONSTRAINT impact_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(campaign_id);


--
-- Name: impact impact_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impact
    ADD CONSTRAINT impact_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- PostgreSQL database dump complete
--


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20211011065334'),
    ('20211011213008'),
    ('20211011223848'),
    ('20211012031931'),
    ('20211012070302'),
    ('20211017060428');
