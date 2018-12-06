-- Table: public."SurveyResultTbl"



DROP TABLE public."aa_survey_results";

CREATE TABLE public."aa_survey_results"
(
    "id" SERIAL NOT NULL,
    "userid" bigint NOT NULL,
    "ac_id" integer NOT NULL,
    "pb_id" integer NOT NULL,
    "a1" integer NOT NULL,
    "a2" integer NOT NULL,
    "user_timestamp" timestamp  NOT NULL,
    CONSTRAINT "aa_survey_results_pkey" PRIMARY KEY ("id")
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."aa_survey_results"
    OWNER to postgres;
COMMENT ON TABLE public."aa_survey_results"
    IS ' (, AC, PB, A1, A2, UserTimeStamp) values (97668, 29, 309, 19, 7, ''2018-12-05T15:52:18.934Z''); 
	INSERT into aa_survey_results (UserId, AC, PB, A1, A2, UserTimeStamp) values (65469, 20, 154, 3, 9, ''2018-12-06T01:47:33.500Z''); ';