# 데이터베이스 강의자료 주차별·강의별 핵심 용어/키워드 학습노트

> 기준: 업로드된 데이터베이스 강의 PDF 전체를 파일명/장 번호 흐름에 맞춰 재구성했다. 실제 수업 주차가 PDF에 명시되지 않은 구간은 `강의 자료 순서` 기준으로 배치했다. 중복 업로드된 PDF는 같은 내용으로 보고 한 번만 정리했다.

---

## 0. 전체 강의 로드맵

### 강의 목표
- 데이터 / 데이터베이스 이해
- 관계형 데이터 모델 이해
- SQL 언어 사용 능력 배양
- Oracle DBMS를 이용한 실습
- 개체-관계 모델(Entity-Relationship Model)을 통한 데이터베이스 설계 모델 이해
- 트랜잭션 개념 이해

### 전체 강의 축
1. **데이터베이스 전반**: 데이터, 정보, 지식, DBMS, 사용자, 파일 시스템과 DBMS 비교
2. **사용자/개발자 관점**: 관계형 데이터 모델, 관계형 데이터베이스, 관계 대수, SQL
3. **설계 관점**: ERD → 테이블 스키마 변환, 정규화, 함수적 종속
4. **DBMS 내부 관점**: Oracle 구조, 물리적 저장 구조, 인덱스, 트랜잭션, 동시성 제어, 복구
5. **실습 관점**: Oracle 계정, 테이블스페이스, SQL DDL/DML, 무결성 제약, 권한 제어

### 시험 우선순위 감각
- 1순위: **관계형 데이터 모델 / SQL 사용법**
- 2순위: **데이터베이스 설계 / 모델링 / 정규화**
- 3순위: **트랜잭션 / 동시성 제어 / 복구 / 인덱스**
- 4순위: **Oracle 세부 실습 문법 / 계정·권한 관리**

---

# 1주차/1강. 강의소개

## 핵심 키워드
- 데이터베이스
- 관계형 데이터 모델
- SQL
- Oracle DBMS
- Entity-Relationship Model
- 정규화
- 데이터베이스 시스템 아키텍처
- 트랜잭션
- 동시성 제어
- 복구/회복
- 과제와 시험
- 생성형 AI 활용

## 핵심 개념
- 이 과목은 단순 SQL 암기 과목이 아니라, **현실의 정보를 테이블 구조로 모델링하고, SQL로 조작하며, DBMS 내부에서 이를 안전하고 효율적으로 관리하는 구조**를 배우는 과목이다.
- 실습은 Oracle DBMS 기반으로 진행된다.
- 관계형 모델과 SQL은 중간·기말 모두에서 가장 높은 비중으로 볼 수 있다.
- 트랜잭션, 동시성 제어, 복구는 DBMS 내부 원리를 이해하는 후반부 핵심이다.

## 학습 포인트
- “데이터를 어떻게 표현하는가?” → 관계형 모델
- “데이터를 어떻게 질의하는가?” → SQL / 관계대수
- “데이터를 어떻게 잘 설계하는가?” → ERD / 정규화
- “동시 실행과 장애에도 어떻게 안전하게 유지하는가?” → 트랜잭션 / 동시성 / 복구

---

# 2주차/2강. 제1장 데이터와 데이터베이스

## 2.1 핵심 키워드
- 데이터(data)
- 정보(information)
- 지식(knowledge)
- 데이터베이스(database)
- 일시적 데이터(transient data)
- 영구적 데이터(persistent data)
- 비휘발성 매체
- 데이터베이스 관리 시스템(DBMS)
- 파일 시스템(file system)
- 데이터 공유
- 데이터 중복
- 일관성(consistency)
- 동시성 문제(concurrency problem)
- 무결성(integrity)
- 데이터 독립성(data independence)
- 자원 관리
- 보안성(security)
- 안정성/reliability
- 최종 사용자(end user)
- 응용 프로그램 개발자(application programmer)
- 데이터베이스 관리자(DBA)
- DBMS 개발자

## 2.2 데이터, 정보, 지식
| 구분 | 의미 | 예시 감각 |
|---|---|---|
| 데이터 | 실세계의 실체를 묘사하는 값 | 이름, 키, 몸무게, 학점 숫자 |
| 정보 | 데이터로부터 유도된 사실/의미 | 학점 추세, 성적 변화 그래프 |
| 지식 | 데이터를 처리하고 판단하는 방법/규칙 | “성적이 하락 중이면 학습 전략을 바꿔야 한다” |

### 핵심 구조
- 데이터는 **값**이다.
- 정보는 **값에서 읽어낸 의미**다.
- 지식은 **의미를 해석하고 행동으로 연결하는 규칙**이다.

## 2.3 데이터베이스
- 필요한 정보를 모아놓은 것
- 조직이나 개인이 사용하는 **조작 가능한 저장 데이터의 모임**
- 특정 목적을 위해 저장, 검색, 정렬, 계산, 갱신 등 데이터 처리 작업을 수행하는 저장 구조
- 일반적인 데이터베이스는 **영구적 데이터**를 전제로 한다.

## 2.4 일시적 데이터 vs 영구적 데이터
| 구분 | 의미 | 예시 |
|---|---|---|
| 일시적 데이터 | 프로세스 실행 중에만 존재 | 프로그램 변수 |
| 영구적 데이터 | 프로세스 생명주기와 독립적으로 존재 | DB에 저장된 학생 정보 |

## 2.5 DBMS
- DBMS = DataBase Management System
- 컴퓨터에 저장된 데이터베이스를 관리해주는 소프트웨어 시스템
- 비유: 창고 = 데이터베이스, 창고관리인 = DBMS, 물건 = 데이터, 직원 = 응용 프로그램/사용자

## 2.6 DBMS가 제공하는 기능
1. **정보 표현 틀 제공**
   - 현실 세계 정보를 컴퓨터에 저장할 수 있는 양식 제공
2. **데이터 공유 기능**
   - 여러 응용 프로그램이 같은 데이터를 공유
   - 데이터 중복 제거와 일관성 유지에 도움
3. **동시성 문제 처리**
   - 여러 사용자가 동시에 같은 데이터를 조작할 때 충돌을 제어
4. **데이터 무결성 유지**
   - 데이터가 얼마나 정확하고 모순 없는지 보장
5. **데이터 독립성 제공**
   - 응용 프로그램이 데이터의 물리적 저장 방식을 몰라도 사용 가능
6. **효율적 자원 관리**
   - 디스크 배치, 메모리 적재, 대용량 처리 최적화
7. **보안성과 안정성 유지**
   - 보안성: 사람으로부터 보호
   - 안정성: 장애/고장으로부터 보호

## 2.7 파일 시스템과 DBMS 비교
| 항목 | 파일 시스템 | DBMS |
|---|---|---|
| 기본 역할 | 파일 읽기/쓰기 | 데이터베이스 관리 기능 제공 |
| 데이터 구조 | 프로그램마다 직접 관리 | DBMS가 공통 구조 제공 |
| 동시 접근 | 충돌 위험 큼 | 동시성 제어 제공 |
| 보안 | 제한적 | 권한 제어 가능 |
| 복구 | 직접 구현 필요 | 복구 기능 제공 |
| 데이터 독립성 | 약함 | 강함 |

## 2.8 사용자 분류
- **최종 사용자**: 응용 프로그램 UI를 통해 업무 처리
- **숙련된 최종 사용자**: DBMS에 직접 질의 가능
- **응용 프로그램 개발자**: DBMS 기반 응용 프로그램 개발
- **DBA**: DBMS, 하드웨어, 소프트웨어, 계정, 권한, 성능, 백업 등을 관리
- **DBMS 개발자**: DBMS 내부 모듈 구현

## 2.9 시험 포인트
- 데이터/정보/지식 구분
- transient vs persistent
- DBMS의 기능 나열 및 설명
- 파일 시스템만 사용할 때의 문제점
- DBMS 사용자 유형
- 데이터 독립성과 무결성의 의미

---

# 3주차/3강. 제2장 관계형 데이터베이스

## 3.1 핵심 키워드
- 데이터 모델(data model)
- 관계형 데이터 모델(relational data model)
- 릴레이션(relation)
- 테이블(table)
- 속성(attribute) / 필드(field) / 컬럼(column)
- 튜플(tuple) / 레코드(record) / 행(row)
- 도메인(domain)
- 원자값(atomic value)
- 널(null)
- 테이블 스키마(table schema)
- 테이블 인스턴스(table instance)
- 차수(degree)
- 기수(cardinality)
- 키(key)
- 수퍼키(super key)
- 후보키(candidate key)
- 기본키(primary key)
- 복합키(composite key)
- 외래키(foreign key)
- 참조하는 테이블(referencing table)
- 참조되는 테이블(referenced table)
- 관계형 데이터베이스(relational database)
- 데이터베이스 스키마(database schema)
- 데이터베이스 인스턴스(database instance)
- 관계대수(relational algebra)
- 관계해석(relational calculus)
- 절차적 언어(procedural language)
- 비절차적 언어(non-procedural language)

## 3.2 데이터 모델
- 현실 세계를 단순화·정형화해 표현하는 규범
- 데이터의 특성을 살리면서 목적에 맞는 정보만 표현
- 데이터에 대한 조작이 가능해야 함

## 3.3 릴레이션의 기본 구성
| 관계형 모델 용어 | 강의/실습 용어 | 의미 |
|---|---|---|
| 릴레이션 | 테이블 | 행과 열로 표현된 데이터 집합 |
| 속성 | 필드/컬럼 | 열의 이름 |
| 튜플 | 레코드/행 | 하나의 데이터 행 |
| 도메인 | 값의 범위 | 각 필드가 가질 수 있는 값의 집합 |

## 3.4 도메인과 원자값
- 도메인: 필드가 가질 수 있는 모든 값의 집합
- 도메인의 값은 **원자값**이어야 함
- 원자값: 더 이상 분해되지 않는 값
- 예: `전화번호`, `주소`, `생일` 등이 각각 하나의 필드 값으로 들어간다면 그 필드 값은 하나의 원자값으로 취급

## 3.5 널(null)
- 특정 필드 값을 알지 못하거나 아직 정해지지 않아 입력하지 못한 값
- `0`이나 공백 문자와 다르다.
- 기본키에는 널이 들어갈 수 없다.

## 3.6 스키마와 인스턴스
| 구분 | 의미 |
|---|---|
| 테이블 스키마 | 테이블 정의에 따라 만들어진 데이터 구조. 예: `student(stu_id, name, dept_id)` |
| 테이블 인스턴스 | 실제 레코드가 저장된 현재 상태 |
| 차수(degree) | 스키마에 정의된 필드 수 |
| 기수(cardinality) | 인스턴스에 저장된 레코드 수 |

## 3.7 테이블의 특성
- 중복 레코드가 존재하지 않음
- 레코드 간 순서는 의미 없음
- 레코드 내 필드 순서는 의미 없음
- 모든 필드는 원자값을 가짐

## 3.8 키의 종류
| 키 | 의미 | 특징 |
|---|---|---|
| 수퍼키 | 레코드를 식별할 수 있는 필드 집합 | 불필요한 필드 포함 가능 |
| 후보키 | 최소 필드만으로 구성된 키 | 최소성 만족 |
| 기본키 | 후보키 중 식별자로 선택한 하나 | 널 불가, 중복 불가 |
| 복합키 | 둘 이상의 필드로 구성된 키 | 예: `(stu_id, class_id)` |

### 기본키가 널이면 안 되는 이유
- 기본키는 식별자다.
- 널은 값을 모른다는 뜻이므로 두 레코드의 기본키가 모두 널이면 구별 불가.

## 3.9 외래키
- 다른 테이블의 기본키를 참조하는 필드 집합
- 외래키 조건
  1. 참조 대상 기본키와 동일한 도메인을 가져야 함
  2. 외래키 값은 참조 대상 테이블의 기본키 값 중 하나와 일치하거나 널이어야 함
- 참조하는 테이블: 외래키를 가진 테이블
- 참조되는 테이블: 기본키를 제공하는 테이블

## 3.10 학사 데이터베이스 예제 스키마
```text
student(stu_id, resident_id, name, address, year, dept_id)
department(dept_id, dept_name, office)
professor(prof_id, resident_id, name, dept_id, position, year_emp)
course(course_id, title, credit)
class(class_id, course_id, year, semester, division, prof_id, classroom, enroll)
takes(stu_id, class_id, grade)
```

## 3.11 관계대수
- 데이터 조작 연산을 표현하는 질의어
- 관계대수: 절차적 언어
- 관계해석: 비절차적 언어
- 피연산자: 테이블
- 연산자: 선택, 추출, 재명명, 집합 연산, 카티션 프로덕트, 조인 등

## 3.12 관계대수 기본 연산
| 연산 | 의미 | SQL 대응 감각 |
|---|---|---|
| 선택(selection) | 조건을 만족하는 레코드 선택 | `where` |
| 추출(project) | 원하는 필드만 출력 | `select 필드` |
| 재명명(rename) | 테이블/필드에 임시 이름 부여 | alias |
| 합집합(union) | 두 결과의 합 | `union` |
| 차집합(minus) | 한 결과에서 다른 결과 제거 | `minus` |
| 교집합(intersection) | 공통 결과 | `intersect` |
| 카티션 프로덕트 | 모든 조합 생성 | 조건 없는 다중 테이블 from |

## 3.13 관계대수 추가 연산
| 연산 | 의미 |
|---|---|
| 조인(theta join) | 조건을 만족하는 레코드 결합 |
| 동등조인(equi join) | `=` 조건 기반 조인 |
| 자연조인(natural join) | 같은 이름 필드 기준 조인 후 중복 필드 제거 |
| 외부조인(outer join) | 매치되지 않는 레코드도 결과에 포함, 부족한 필드는 NULL |
| 지정(assignment) | 중간 결과에 이름 부여 |

## 3.14 널 처리 주의
- `dept_id = '920'`인지 알 수 없는 null 값은 참/거짓으로 확정할 수 없다.
- 따라서 일반 조건식 결과에서는 배제되는 흐름으로 이해해야 한다.

## 3.15 시험 포인트
- 릴레이션/속성/튜플/도메인 용어 대응
- 스키마 vs 인스턴스, 차수 vs 기수
- 수퍼키/후보키/기본키/외래키 구분
- 기본키 널 불가 이유
- 관계대수 각 연산의 의미와 SQL 대응
- 카티션 프로덕트와 조인의 차이
- 자연조인과 외부조인의 특징

---

# 4주차/4강. 제3장 Oracle 개요와 구조

## 4.1 핵심 키워드
- Oracle DBMS
- 데이터 블록(data block)
- 익스텐트(extent)
- 세그먼트(segment)
- 테이블스페이스(tablespace)
- 데이터파일(datafile)
- 컨트롤 파일(control file)
- redo 로그 파일
- 매개변수 파일(parameter file)
- alert/trace 로그 파일
- 백업 파일
- `db_block_size`
- `v$parameter`
- `show parameter db_block_size`
- `create tablespace`
- `alter tablespace`
- `drop tablespace`
- 사용자 계정 생성
- quota
- `grant connect, resource`
- Oracle 12c 이후 `c##` prefix
- `alter session set "_ORACLE_SCRIPT"=true;`

## 4.2 Oracle 논리적 구성요소
| 구성요소 | 의미 |
|---|---|
| 데이터 블록 | 데이터가 저장되는 가장 작은 단위 |
| 익스텐트 | 연속적인 여러 데이터 블록의 묶음 |
| 세그먼트 | 여러 익스텐트의 묶음. 같은 종류의 데이터 저장 |
| 테이블스페이스 | 하나 이상의 세그먼트를 포함하는 논리적 저장 단위 |

### 계층 구조
```text
데이터 블록 → 익스텐트 → 세그먼트 → 테이블스페이스
```

## 4.3 데이터 블록
- 데이터 저장의 최소 단위
- 저장할 데이터가 늘어나면 블록 단위로 공간 확보
- 표준 크기는 `db_block_size`에 저장
- 확인:
```sql
show parameter db_block_size;
```
또는 `v$parameter` 조회

## 4.4 익스텐트
- 여러 개의 연속 데이터 블록이 모인 단위
- 세그먼트가 사용하는 공간이 부족하면 새로운 익스텐트를 할당

## 4.5 세그먼트
- 여러 익스텐트가 모인 단위
- 같은 종류의 데이터가 저장됨
- 종류:
  - 데이터 세그먼트: 테이블 저장
  - 인덱스 세그먼트: 인덱스 정보 저장
- 세그먼트는 하나의 테이블스페이스에 저장
- 세그먼트를 구성하는 익스텐트가 디스크상에 반드시 연속 저장되는 것은 아님

## 4.6 테이블스페이스
- Oracle DB의 논리적 저장 단위
- 하나 이상의 세그먼트를 포함
- 테이블 생성 시 테이블스페이스를 사용
- 기본 테이블스페이스 또는 새 테이블스페이스 사용 가능

## 4.7 물리적 구성요소
| 구성요소 | 의미 |
|---|---|
| 데이터파일 | 실제 데이터가 저장되는 디스크 파일 |
| 컨트롤 파일 | DB 물리 구조, DB 이름, redo 로그 위치, 생성 시간, 현재 로그 번호, 체크포인트 정보 저장 |
| redo 로그 파일 | 데이터베이스 변경 내역 저장, 장애 후 복구에 사용 |
| 매개변수 파일 | DB 서버 설정 정보 저장 |
| alert/trace 로그 파일 | Oracle 내부 오류 및 메시지 기록 |
| 백업 파일 | 장애 복구용 복사본 |

## 4.8 데이터파일 예시
- `SYSAUX01.DBF`, `SYSTEM01.DBF`: Oracle 시스템 관리용
- `TEMP01.DBF`: 임시 데이터
- `USER01.DBF`: 사용자 계정 데이터
- `EXAMPLE01.DBF`: 예제 테이블
- `UNDOTBS01.DBF`: 복구/Undo 관련 정보

## 4.9 테이블스페이스 관리 문법
```sql
create tablespace <테이블스페이스 이름>
datafile '<데이터파일 경로명>' size <데이터파일 크기>;
```

```sql
alter tablespace <테이블스페이스 이름>
add datafile '<데이터파일 경로명>' size <데이터파일 크기>;
```

```sql
drop tablespace <삭제할 테이블스페이스 이름>;
```

## 4.10 사용자 계정과 테이블스페이스
```sql
create user <사용자 계정>
identified by <비밀번호>
default tablespace <사용할 테이블스페이스 이름>
quota <용량> on <사용할 테이블스페이스 이름>;
```

권한 부여:
```sql
grant connect, resource to <사용자 계정>;
```

## 4.11 Oracle 12c 이후 계정 생성 주의
- Oracle 12c 이후에는 기본적으로 사용자 계정이 `c##`로 시작해야 하는 제약이 생김.
- 이를 피하기 위한 실습 설정:
```sql
alter session set "_ORACLE_SCRIPT"=true;
```

## 4.12 시험 포인트
- 논리적 구성요소 순서: block → extent → segment → tablespace
- 물리적 구성요소 역할
- redo 로그 파일의 의미
- 테이블스페이스 생성/수정/삭제 문법
- 계정 생성 시 default tablespace와 quota 의미
- `c##` 문제와 `_ORACLE_SCRIPT` 설정

---

# 5주차/5강. 제4장 SQL(1) — SQL 개요, DDL, 기본 DML

## 5.1 핵심 키워드
- SQL(Structured Query Language)
- Sequel
- ANSI/ISO 표준
- SQL-92, SQL3
- 비절차적 언어
- DDL(Data Definition Language)
- DML(Data Manipulation Language)
- `create table`
- `drop table`
- `alter table`
- `primary key`
- `foreign key`
- `not null`
- `char`, `varchar2`, `int`, `float`, `date`, `timestamp`
- `insert into`
- 필드리스트
- 값리스트
- 외래키 생성/삭제 순서

## 5.2 SQL의 의미
- SQL은 관계형 데이터베이스의 표준 질의어다.
- 관계대수/관계해석은 이론적으로 중요하지만 상용 사용에는 어렵다.
- SQL은 자연어와 유사하고 비절차적이어서 사용하기 쉽다.

## 5.3 DDL과 DML
| 분류 | 의미 | 대표 명령 |
|---|---|---|
| DDL | 데이터 저장 구조 정의 | `create table`, `alter table`, `drop table` |
| DML | 데이터 접근/조작 | `select`, `insert`, `delete`, `update` |

## 5.4 Oracle 데이터 타입
| 표준 SQL | Oracle | 설명 |
|---|---|---|
| `char(n)` | `char(n)` | 고정 길이 문자열, Oracle 최대 2000 byte |
| `varchar(n)` | `varchar2(n)` | 가변 길이 문자열, Oracle 최대 4000 byte |
| `int` | `int` | 정수형 |
| `float` | `float` | 부동소수 |
| `date` | `date` | 년/월/일, 기본 형식 `yy/mm/dd` |
| `timestamp` | `timestamp` | 년/월/일/시/분/초 |

## 5.5 테이블 생성 기본형
```sql
create table <테이블이름> (
  <필드명> <데이터타입>,
  ...
);
```

## 5.6 기본키 설정
```sql
constraint <제약식명> primary key(<필드리스트>)
```

예:
```sql
create table department (
  dept_id varchar2(10),
  dept_name varchar2(20) not null,
  office varchar2(20),
  constraint pk_department primary key(dept_id)
);
```

## 5.7 외래키 설정
```sql
constraint <제약식명> foreign key(<필드리스트>)
references <참조테이블>(<참조필드>)
```

예:
```sql
constraint fk_student foreign key(dept_id)
references department(dept_id)
```

## 5.8 학사 DB 주요 테이블
### department
```text
department(dept_id, dept_name, office)
```

### student
```text
student(stu_id, resident_id, name, year, address, dept_id)
```

### professor
```text
professor(prof_id, resident_id, name, dept_id, position, year_emp)
```

### course
```text
course(course_id, title, credit)
```

### class
```text
class(class_id, course_id, year, semester, division, prof_id, classroom, enroll)
```

### takes
```text
takes(stu_id, class_id, grade)
```

## 5.9 테이블 삭제
```sql
drop table <테이블이름>;
```

주의:
- 다른 테이블이 외래키로 참조 중이면 삭제 불가.
- 예: `takes`가 `class`를 참조하면 `takes`를 먼저 삭제하거나 외래키를 해제해야 `class` 삭제 가능.

## 5.10 테이블 수정
필드 추가:
```sql
alter table <테이블이름> add <추가할필드>;
```

필드 삭제:
```sql
alter table <테이블이름> drop column <삭제할필드>;
```

## 5.11 레코드 삽입
```sql
insert into <테이블이름> (<필드리스트>) values (<값리스트>);
```

핵심 규칙:
- 필드리스트를 쓰면 테이블 생성 순서와 달라도 됨.
- 생략된 필드는 null 입력.
- `not null` 필드는 생략 불가.
- 필드리스트 전체를 생략하면 테이블 생성 시 정의한 필드 순서대로 값을 넣어야 함.

## 5.12 외래키 관련 생성/삭제 순서
- 생성할 때: **참조되는 테이블 먼저 생성**
  - 예: `department` 먼저, `student` 나중
- 삭제할 때: **참조하는 테이블 먼저 삭제**
  - 예: `takes` 먼저, `class` 나중

## 5.13 시험 포인트
- DDL/DML 구분
- `create table` 구조
- `primary key`, `foreign key`, `not null` 문법
- 참조 무결성 때문에 테이블 생성/삭제 순서가 중요함
- `insert`에서 필드리스트 생략/사용 차이

---

# 6주차/6강. 제4장 SQL(2) — 수정, 삭제, 검색 기본 구조, LIKE, 집합 연산

## 6.1 핵심 키워드
- `update`
- `set`
- `delete`
- `where`
- `select`
- `from`
- `distinct`
- `*`
- 산술식
- 조인 질의
- `order by`
- `desc`
- alias / 재명명
- self join
- 필드 재명명
- `like`
- `_`
- `%`
- `union`
- `union all`
- `intersect`
- `minus`

## 6.2 레코드 수정
```sql
update <테이블이름>
set <수정내역>
where <조건>;
```

- `set`에는 산술식 가능
- 여러 필드 수정 시 `,` 사용
- `where` 생략 시 모든 레코드 수정

예:
```sql
update student
set year = year + 1;
```

## 6.3 레코드 삭제
```sql
delete from <테이블이름>
where <조건>;
```

- `where` 생략 시 모든 레코드 삭제
- 단, 테이블 자체는 삭제되지 않음
- 테이블 삭제는 `drop table`

## 6.4 외래키 관련 DML 주의
- 외래키 값 삽입 시 참조 대상 테이블에 해당 값이 먼저 존재해야 함.
- 외래키 값 수정 시 참조 대상 테이블에 존재하는 값으로만 수정 가능.
- 외래키로 참조되는 부모 테이블의 레코드는 자식 레코드가 있으면 삭제 오류 가능.

## 6.5 SELECT 기본 구조
```sql
select <필드리스트>
from <테이블리스트>
where <조건>;
```

| 절 | 관계대수 대응 | 의미 |
|---|---|---|
| `select` | 추출 | 출력할 필드 |
| `from` | 카티션 프로덕트 | 질의에 필요한 테이블 |
| `where` | 선택 | 조건 |

## 6.6 중복 제거와 전체 필드
```sql
select distinct address
from student;
```

```sql
select *
from student;
```

## 6.7 산술식 사용
```sql
select name, 2012 - year_emp
from professor;
```

## 6.8 조인 질의 기본형
```sql
select student.name, student.stu_id, department.dept_name
from student, department
where student.dept_id = department.dept_id;
```

## 6.9 정렬
```sql
order by <필드리스트>
```

- 기본: 오름차순
- 내림차순: `desc`

```sql
select name, stu_id
from student
where year = 3 or year = 4
order by name desc, stu_id;
```

## 6.10 재명명(alias)
### 테이블 alias
```sql
select s.name, d.dept_name
from student s, department d
where s.dept_id = d.dept_id;
```

### 자기 조인/self join
```sql
select s2.name
from student s1, student s2
where s1.address = s2.address and s1.name = '김광식';
```

### 필드 재명명
```sql
select name 이름, position 직위, 2012-year_emp 재직연수
from professor;
```

## 6.11 LIKE 연산자
```sql
where <필드이름> like <문자열패턴>
```

| 패턴 | 의미 |
|---|---|
| `_` | 임의의 한 문자 |
| `%` | 임의의 여러 문자 |
| `%서울%` | 서울 포함 |
| `%서울` | 서울로 끝남 |
| `서울%` | 서울로 시작 |
| `___` | 정확히 세 글자 |
| `___%` | 최소 세 글자 |

예:
```sql
select *
from student
where name like '김%';
```

## 6.12 집합 연산
```sql
<select문1> <집합연산자> <select문2>
```

조건:
- 두 select문의 필드 개수와 데이터 타입이 같아야 함.

| 연산자 | 의미 |
|---|---|
| `union` | 합집합, 중복 제거 |
| `union all` | 합집합, 중복 허용 |
| `intersect` | 교집합 |
| `minus` | 차집합 |

## 6.13 시험 포인트
- `update`에서 where 생략 위험
- `delete`와 `drop table` 차이
- `select-from-where`가 관계대수의 추출/카티션/선택과 연결됨
- `distinct`, `*`, 산술식, alias
- LIKE의 `_`, `%`
- `union` vs `union all`
- `intersect`, `minus`를 이용해 질의를 바꿔 표현하는 능력

---

# 7주차/7강. 제4장 SQL(3-1) — JOIN

## 7.1 핵심 키워드
- Join
- Inner join
- Outer join
- Left outer join
- Right outer join
- Full outer join
- Natural join
- Cross join
- Cartesian product
- implicit join
- traditional join
- Oracle join
- explicit join
- standard join
- join condition
- equi-join
- `on`
- `using`
- null padding

## 7.2 JOIN 종류
| 종류 | 의미 |
|---|---|
| Inner join | 조인 조건에 일치하는 레코드만 검색 |
| Outer join | 일치하지 않아도 한쪽/양쪽 테이블의 레코드를 결과에 포함 |
| Natural join | 동일 이름 컬럼 기준으로 자동 equi-join |
| Cross join | Cartesian product와 동일 |

## 7.3 implicit join vs explicit join
### implicit join
```sql
select s.name, s.stu_id, d.dept_name
from student s, department d
where s.dept_id = d.dept_id;
```

특징:
- 조인 조건을 `where`에 일반 조건과 함께 표현
- 조인이 많으면 가독성과 디버깅이 어려움

### explicit join
```sql
select s.name, s.stu_id, d.dept_name
from student s inner join department d
on (s.dept_id = d.dept_id);
```

특징:
- 조인 조건을 `from` 절에 분리
- 가독성과 디버깅에 유리

## 7.4 표준 inner join 문법
```sql
select column_name(s)
from table1 inner join table2
on table1.column_name = table2.column_name;
```

```sql
select column_name(s)
from table1 inner join table2
using (common_column_name);
```

## 7.5 Outer join
### Left outer join
- 왼쪽 테이블의 레코드는 조인 조건에 맞는 오른쪽 레코드가 없어도 결과에 포함
- 오른쪽 필드는 null로 채움

```sql
select c.title, c.credit, s.year, s.semester
from course c left outer join class s
using (course_id);
```

### Right outer join
```sql
select c.title, c.credit, s.year, s.semester
from course c right outer join class s
on (c.course_id = s.course_id);
```

### Full outer join
- 양쪽 테이블에서 매치되지 않는 레코드 모두 포함
- 매치되지 않는 나머지 필드는 null

```sql
select title, credit, year, semester
from course full outer join class
using (course_id);
```

## 7.6 Natural join
```sql
select name, stu_id, dept_name
from student natural join department;
```

주의:
- 동일 이름 컬럼 전체에 대해 equi-join을 수행
- 의도하지 않은 같은 이름 컬럼이 많으면 위험할 수 있음

## 7.7 시험 포인트
- inner join은 “맞는 것만”, outer join은 “안 맞아도 살림”
- left/right/full outer join의 기준 테이블
- `on`과 `using` 차이
- implicit join을 explicit join으로 변환할 수 있어야 함
- natural join은 편하지만 자동 기준 컬럼 때문에 조심

---

# 8주차/8강. 제4장 SQL(3-2) — 집계 함수, GROUP BY, HAVING

## 8.1 핵심 키워드
- aggregate function
- `count`
- `sum`
- `avg`
- `max`
- `min`
- `count(*)`
- `count(필드)`
- `count(distinct 필드)`
- null 제외
- `group by`
- `having`
- 그룹 조건
- `where` vs `having`

## 8.2 집계 함수
| 함수 | 의미 | 주의 |
|---|---|---|
| `count` | 개수 | `count(필드)`는 null 제외, `count(*)`는 레코드 수 |
| `sum` | 합 | 숫자형 필드만 |
| `avg` | 평균 | 숫자형 필드만 |
| `max` | 최댓값 | 비교 가능한 필드 |
| `min` | 최솟값 | 비교 가능한 필드 |

집계 함수는 주로 `select`절과 `having`절에서 사용한다.

## 8.3 COUNT
```sql
select count(*)
from student
where year = 3;
```

```sql
select count(dept_id)
from student;
```

```sql
select count(distinct dept_id)
from student;
```

핵심:
- `count(*)`: 레코드 전체 개수
- `count(dept_id)`: `dept_id`가 null이 아닌 레코드 수
- `count(distinct dept_id)`: 중복 제거 후 개수

## 8.4 SUM/AVG/MIN/MAX
```sql
select sum(2012 - year_emp)
from professor;
```

```sql
select avg(2012 - year_emp)
from professor;
```

```sql
select max(sal)
from emp e, dept d
where e.deptno = d.deptno and dname = 'ACCOUNTING';
```

## 8.5 GROUP BY
```sql
select dept_id, count(*)
from student
group by dept_id;
```

핵심:
- 집계 함수만 쓰면 전체 레코드 대상 집계
- `group by`를 쓰면 그룹별 집계
- `select`절에 집계 함수가 있을 때, 집계 함수가 아닌 일반 필드는 보통 `group by`에 포함되어야 함

## 8.6 HAVING
- 그룹에 대한 조건을 명시할 때 사용
- `where`: 개별 레코드에 대한 조건
- `having`: 그룹화된 결과에 대한 조건

예시 구조:
```sql
select dept_name, count(*)
from student s, department d
where s.dept_id = d.dept_id
group by dept_name
having count(*) >= 2;
```

## 8.7 시험 포인트
- `where`와 `having` 구분
- `count(*)`와 `count(필드)` 차이
- null이 집계에서 어떻게 처리되는지
- `group by`에 지정된 필드를 `select`에 쓸 수 있음
- “학과별 학생 수”, “부서별 최대 급여” 같은 문제는 group by 패턴

---

# 9주차/9강. 제4장 SQL(4) — NULL, 중첩 질의, VIEW

## 9.1 핵심 키워드
- null
- `is null`
- `is not null`
- `<>`
- nested query
- subquery
- inner query
- outer query
- `in`
- `not in`
- `some`
- `any`
- `all`
- `exists`
- `not exists`
- correlated subquery
- view
- virtual table
- `create or replace view`
- `grant create view`
- `drop view`
- `with read only`
- view-based security

## 9.2 NULL 검색
```sql
select stu_id
from takes
where grade is null;
```

```sql
select stu_id
from takes
where grade is not null;
```

주의:
- `grade <> 'A+'`는 grade가 null인 레코드를 포함하지 않는다.
- `count(*)`는 특정 필드가 아니라 레코드 전체를 세므로 null 존재와 무관하다.

## 9.3 중첩 질의
- SQL문 안에 다른 SQL문을 중첩하여 사용하는 질의
- 내부질의/부질의: 내부에 포함된 SQL문
- 외부질의: 부질의를 포함하는 SQL문
- 부질의는 `from`절 또는 `where`절에 위치 가능

## 9.4 IN / NOT IN
```sql
select title
from course
where course_id in (
  select distinct course_id
  from class
  where classroom = '301호'
);
```

- `in`: 부질의 결과 집합에 포함되는지 확인
- `not in`: 부질의 결과 집합에 포함되지 않는지 확인

## 9.5 SOME / ANY / ALL
| 표현 | 의미 |
|---|---|
| `= some` | 부질의 결과 중 하나와 같음. `in`과 같은 의미 |
| `<= some` | 부질의 결과 중 하나보다 작거나 같음 |
| `= all` | 부질의 결과의 모든 값과 같음 |
| `<= all` | 부질의 결과의 모든 값보다 작거나 같음 |

예:
```sql
select c1.course_id, title, year, semester, prof_id
from class c1, course c2
where c1.course_id = c2.course_id
  and enroll >= all (select enroll from class);
```

## 9.6 EXISTS / NOT EXISTS
- `exists`: 부질의 결과가 하나 이상 있으면 참
- `not exists`: 부질의 결과가 하나도 없으면 참

```sql
select title
from course
where exists (
  select *
  from class
  where classroom = '301호'
    and course.course_id = class.course_id
);
```

## 9.7 VIEW
- 기존 테이블로부터 생성되는 가상의 테이블
- 물리적으로 독립 테이블을 생성하는 것이 아니라, 기존 테이블 조합을 테이블처럼 보이게 함

### 기능
1. 보안: 특정 사용자에게 일부 필드/레코드를 숨김
2. 질의 단순화: 복잡한 질의 결과를 뷰로 저장해 쉽게 사용

## 9.8 뷰 생성
```sql
create or replace view <뷰이름> as
<select문>;
```

- `or replace`: 같은 이름의 뷰가 있으면 기존 뷰를 지우고 새로 생성
- 사용자 계정에서 뷰 생성 권한이 없을 수 있음

뷰 생성 권한:
```sql
grant create view to <사용자 계정>;
```

## 9.9 뷰 사용과 삭제
```sql
select *
from v_takes;
```

```sql
drop view <뷰이름>;
```

## 9.10 읽기 전용 뷰
```sql
create or replace view <뷰이름> as
<select문>
with read only;
```

- `insert`, `update`, `delete` 불가능하게 함

## 9.11 시험 포인트
- null 비교는 `= null`이 아니라 `is null`
- `<>` 조건에서 null은 포함되지 않음
- `in`, `some`, `all`, `exists` 의미 구분
- `not in`과 `not exists` 변환 감각
- view는 보안과 질의 단순화에 사용
- `with read only` 의미

---

# 10주차/10강. 제5장 무결성과 보안

## 10.1 핵심 키워드
- 무결성 제약(integrity constraint)
- 무결성 규칙(integrity rule)
- 기본키 무결성 제약
- 참조 무결성 제약
- 테이블 무결성 제약
- `not null`
- `unique`
- `check`
- `default`
- 도메인 제약(domain constraint)
- assertion
- trigger
- 응용 프로그램 무결성 제약
- 데이터베이스 보안
- DBA
- 객체(object)
- 권한(privilege)
- DML 권한
- DDL 권한
- owner
- `grant`
- `revoke`
- `references`
- `public`
- `all privileges`
- `with grant option`
- role
- `create role`
- `drop role`
- view security
- system privilege
- object privilege
- `with admin option`

## 10.2 무결성 제약
- 데이터베이스에 저장된 데이터가 실제 세계 정보를 모순 없이 반영하도록 보장하는 조건
- 삽입/삭제/수정 시 제약을 검사해 잘못된 데이터 입력을 막음

예:
- 학생은 하나의 학과에 소속
- 하나의 강좌는 한 명의 담당교수 배정
- 하나의 교과목은 학기마다 두 강좌 이하만 개설
- 학생은 한 학기에 20학점 이상 수강 불가

## 10.3 무결성 제약 유형
| 유형 | 세부 제약 |
|---|---|
| 기본적 무결성 제약 | 기본키 무결성, 참조 무결성 |
| 테이블 무결성 제약 | NOT NULL, UNIQUE, CHECK, DEFAULT |
| 기타 무결성 제약 | Assertion, Trigger, 응용 프로그램 제약 |

## 10.4 기본키 무결성 제약
정의:
- 기본키는 null 값을 가질 수 없음
- 기본키 값이 동일한 레코드가 같은 테이블에 두 개 이상 존재할 수 없음

문법:
```sql
constraint <제약식명> primary key (<필드리스트>)
```

나중에 추가:
```sql
alter table student
add constraint pk_student primary key (stu_id);
```

삭제:
```sql
alter table student
drop constraint pk_student;
```

## 10.5 참조 무결성 제약
- 외래키 값은 참조되는 테이블의 기본키 값 중 하나와 일치하거나 null이어야 함
- 존재하지 않는 레코드를 참조하지 못하게 함

문법:
```sql
constraint <제약식명> foreign key (<필드리스트1>)
references <테이블이름> (<필드리스트2>)
```

추가:
```sql
alter table student
add constraint fk_dept foreign key (dept_id)
references department (dept_id);
```

삭제:
```sql
alter table student
drop constraint fk_dept;
```

## 10.6 NOT NULL
- 특정 필드에 null 입력을 허용하지 않음
- 기본키는 명시하지 않아도 자동으로 null 불가

```sql
resident_id varchar2(14) not null
```

## 10.7 UNIQUE
- 해당 필드 또는 필드 집합이 중복 값을 갖지 않도록 함
- 후보키 자격을 가짐
- 단, `not null`이 없으면 null 허용 가능

```sql
constraint uc_rid unique (resident_id)
```

복합 unique:
```sql
constraint uc_name unique (family_name, given_name)
```

## 10.8 CHECK
- 데이터 타입보다 더 세부적인 값의 범위 제한
- 도메인 제약의 구현 수단

```sql
constraint chk_year check (year >= 1 and year <= 4)
```

```sql
address varchar2(10) check (address in ('서울', '부산'))
```

## 10.9 DEFAULT
- 레코드 삽입 시 값이 정해지지 않은 필드에 기본값 자동 입력

```sql
year int default 1
```

Oracle 표준과 다른 수정 문법:
```sql
alter table student modify (year int default 1);
alter table student modify (year int default null);
```

주의:
- DEFAULT는 필드를 생략했을 때 적용
- 의도적으로 null을 넣으면 default가 적용되지 않음

## 10.10 무결성 제약 설정의 유의점
- 너무 많은 제약은 예외 데이터 처리에 문제를 만들 수 있음
  - 예: 외국인 학생에게 주민등록번호가 없는데 `resident_id not null`이면 삽입 불가
- 삽입/삭제/수정 때마다 제약 검사를 하므로 성능 부담 가능

## 10.11 기타 무결성 제약
### Assertion
```sql
create assertion <주장이름> check <조건식>;
```
- DB 전체 수준의 복잡한 조건을 감시
- 현재 데이터와 이후 변경 모두 조건 만족 검사

### Trigger
- 특정 이벤트 발생 시 자동 실행되는 절차적 제약 수단

### 응용 프로그램 제약
- DBMS 제약만으로 표현 어려운 조건을 애플리케이션 코드에서 검사
- 성능 부담을 줄일 수 있으나 구현 책임이 커짐

## 10.12 데이터베이스 보안
- DBA는 권한 없는 사용자로부터 데이터를 보호해야 함.
- DBMS는 권한 없는 접근을 차단하는 기능 제공

## 10.13 권한 제어 대상
| 구분 | 예시 |
|---|---|
| 객체 | 테이블, 뷰, 필드 |
| DML 권한 | `select`, `insert`, `delete`, `update` |
| DDL 권한 | `create table`, `alter table`, `drop table`, `create index` |

## 10.14 사용자 분류
| 사용자 | 권한 |
|---|---|
| DBA | 모든 객체에 대해 모든 권한, 권한 부여/회수 가능 |
| 객체 소유자(owner) | 자신이 만든 객체에 대한 모든 권한 |
| 기타 사용자 | 기본적으로 권한 없음, 부여받아야 사용 가능 |

## 10.15 GRANT
```sql
grant <권한리스트> on <객체명> to <사용자리스트>;
```

예:
```sql
grant select on student to kim;
grant select, delete on student to kim;
grant select(stu_id) on student to kim;
grant references(dept_id) on department to kim;
grant select on student to public;
grant all privileges on student to lee;
```

## 10.16 WITH GRANT OPTION
```sql
grant select on student to kim with grant option;
```

- 권한을 받은 사용자가 다른 사용자에게 같은 권한을 다시 부여 가능
- 보안상 남용 위험

## 10.17 REVOKE
```sql
revoke <권한리스트> on <객체명> from <사용자리스트>;
```

예:
```sql
revoke select on student from kim;
```

- with grant option으로 전파된 권한은 연쇄 회수될 수 있음.

## 10.18 ROLE
- 권한에 따른 사용자 그룹
- 반복 grant/revoke를 줄이는 수단
- DBA만 생성 가능

```sql
create role employee;
create role manager;
grant employee to lee, kim;
grant manager to chang, choi;
grant select on student to employee;
revoke insert on student from manager;
revoke manager from choi;
drop role manager;
```

## 10.19 뷰를 이용한 권한 제어
- 테이블 일부 필드/레코드만 접근 허용할 때 뷰 정의
- 실제 테이블 접근은 차단하고 뷰에만 권한 부여

```sql
create view junior as
select stu_id, name, year, dept_id
from student
where year = 3;

grant select on junior to kim;
```

## 10.20 시험 포인트
- 기본키 무결성 vs 참조 무결성
- `not null`, `unique`, `check`, `default` 차이
- unique는 null 허용 가능하다는 점
- default는 생략 시 적용, 명시적 null에는 적용 안 됨
- `grant`, `revoke`, `with grant option`
- role의 목적
- view를 통한 필드/레코드 단위 보안

---

# 11주차/11강. 제6장 데이터베이스 설계(2) — ERD에서 테이블 스키마 변환

## 11.1 핵심 키워드
- 논리적 설계
- ERD
- 테이블 스키마 변환
- 강성 개체집합(strong entity set)
- 약성 개체집합(weak entity set)
- 부분 키(partial key)
- 식별 관계
- 관계집합(relationship set)
- 다대일(many-to-one)
- 다대다(many-to-many)
- 일대일(one-to-one)
- 자기연관 관계집합(recursive relationship)
- 다중값 속성(multivalued attribute)
- 복합 속성(composite attribute)
- 일반화(generalization)
- 상위 개체집합
- 하위 개체집합
- 대리키(surrogate key)
- Barker ERD
- IE/Crow's Foot ERD

## 11.2 논리적 설계
- ERD로부터 테이블 스키마를 생성하는 과정
- 정해진 규칙에 따라 자동 변환 가능

논리적 설계 과정:
1. 강성 개체집합을 테이블로 변환
2. 약성 개체집합을 테이블로 변환
3. 관계집합을 테이블로 변환
4. 다중값 속성, 복합 속성, 일반화 등 특수 상황 변환

## 11.3 강성 개체집합 변환
규칙:
- 하나의 강성 개체집합 → 하나의 테이블
- 강성 개체집합의 속성 → 테이블 필드
- 개체집합의 기본키 → 테이블 기본키

예:
```text
student(stu_id, resident_id, name, address, year)
department(dept_id, dept_name, office)
professor(prof_id, resident_id, name, position, year_emp)
course(course_id, title, credit)
```

## 11.4 약성 개체집합 변환
규칙:
- 약성 개체집합은 자신만의 완전한 키가 없으므로 강성 개체집합의 기본키를 가져온다.
- 강성 개체집합의 기본키 + 약성 개체집합의 부분 키 = 약성 개체 테이블의 기본키
- 가져온 강성 개체 기본키는 외래키로 정의

일반형:
```text
B(ak, bk, b1, ..., bm)
```
- `ak`: 강성 개체 기본키
- `bk`: 약성 개체 부분 키

예:
```text
class(course_id, year, semester, division, classroom, enroll, prof_id)
```

## 11.5 다대일 관계집합 변환
규칙:
- one 쪽 개체집합의 기본키를 many 쪽 개체집합에 새 필드로 추가
- 추가된 필드는 외래키
- 관계집합에 속성이 있으면 many 쪽 테이블에 결합

예:
```text
student(..., dept_id)
professor(..., dept_id)
class(..., prof_id)
```

## 11.6 다대다 관계집합 변환
규칙:
- 관계된 개체집합들의 기본키 + 관계집합 속성으로 새 테이블 생성
- 기본키는 관련 개체집합들의 기본키를 결합한 복합키
- 각각은 외래키
- 유일성이 보장되지 않으면 대리키 고려

예:
```text
takes(stu_id, course_id, year, semester, division, grade)
```

## 11.7 일대일 관계집합 변환
가능한 방식:
1. 한쪽 테이블에 다른 쪽 기본키를 외래키로 추가
2. 반대쪽 테이블에 외래키 추가
3. 두 테이블을 하나로 합침

선택 기준:
- 참여 제약
- null 발생 가능성
- 조회 패턴
- 조인 빈도

## 11.8 자기연관 관계집합 변환
### 다대일 자기연관
- 같은 테이블 안에 자기 자신을 참조하는 외래키 추가
- 역할 의미가 드러나도록 필드명 변경 필요

예:
```text
employee(employee_id, name, address, ..., manager)
```

### 다대다 자기연관
- 별도 관계 테이블 생성
- 예: 선수 과목 / 후수 과목 관계

## 11.9 다중값 속성 변환
- 관계형 테이블의 속성은 원자값만 가능
- 다중값 속성은 별도 테이블 생성
- 기본키는 원래 개체의 기본키 + 다중값 속성의 원자값

## 11.10 복합 속성 변환
- 복합 속성은 여러 개의 단순 속성으로 분리
- 예: 주소를 시/구/동/상세주소로 분해

## 11.11 일반화 관계 변환
### 방법 1. 상위 개체집합 유지
- 상위 테이블과 하위 테이블을 모두 유지
- 부분 참여에 유리
- 상위/하위 테이블 간 조인이 자주 발생 가능

### 방법 2. 상위 개체집합 제거
- 모든 상위 개체가 하위 개체 중 하나에 속하는 전체 참여일 때 가능
- 공통 필드 조회 시 union이 자주 발생 가능

## 11.12 학사 DB 최종 변환 결과
```text
student(stu_id, resident_id, name, address, year, dept_id)
professor(prof_id, resident_id, name, position, year_emp, dept_id)
department(dept_id, dept_name, office)
course(course_id, title, credit)
class(course_id, year, semester, division, classroom, enroll, prof_id)
takes(stu_id, course_id, year, semester, division, grade)
```

## 11.13 대리키 도입
문제:
- `class`의 기본키가 `(course_id, year, semester, division)`처럼 너무 길면 불편
- `takes`에서 복합 외래키가 길어짐

해결:
```text
class(class_id, course_id, year, semester, division, classroom, enroll, prof_id)
takes(stu_id, class_id, grade)
```

대리키 도입 사례:
1. 기존 기본키가 너무 많은 속성으로 구성되어 다루기 어려울 때
2. 다대다 관계에서 유일성이 보장되지 않을 때

## 11.14 시험 포인트
- 강성/약성 개체집합 변환 규칙
- many-to-one은 one의 PK를 many 쪽 FK로 이동
- many-to-many는 새 테이블 생성
- 다중값 속성은 별도 테이블
- 복합 속성은 분해
- 일반화 변환 방법 1/2 장단점
- 대리키 도입 이유

---

# 12주차/12강. 제7장 함수적 종속과 정규화

## 12.1 핵심 키워드
- 함수적 종속(functional dependency)
- 결정자(determinant)
- 종속자(dependent)
- `X → Y`
- 다대일 함수 종속
- 일대일 함수 종속
- 필드 집합 간 함수 종속
- 포함 규칙
- 분해 규칙
- 합성 규칙
- 이행 규칙
- 키와 함수적 종속
- 정규화(normalization)
- 분해(decomposition)
- 데이터 중복
- 이상현상(anomaly)
- 삽입 이상(insertion anomaly)
- 삭제 이상(deletion anomaly)
- 수정 이상(update anomaly)
- 정규형(normal form)
- 1NF
- 2NF
- 3NF
- BCNF
- 부분 종속(partial dependency)
- 이행 종속(transitive dependency)
- 종속성 보존 분해(dependency-preserving decomposition)
- 무손실 조인 분해(lossless-join decomposition)
- 손실 조인 분해

## 12.2 함수적 종속
정의:
- 테이블 R에서 필드 X 값이 같은 임의의 레코드에 대해 필드 Y 값도 항상 같다면, `Y는 X에 함수적으로 종속된다`고 한다.
- 표현: `X → Y`
- X: 결정자
- Y: 종속자

예:
```text
stu_id → name
stu_id → resident_id
resident_id → stu_id
stu_id → dept_name
dept_name → office
```

## 12.3 함수 종속의 특징
- 다대일 가능: `stu_id → dept_name`
- 일대일 가능: `stu_id → resident_id`, `resident_id → stu_id`
- 결정자/종속자가 여러 필드일 수 있음:
```text
(course_id, year, semester, division) → (prof_id, classroom, enroll)
stu_id → (name, dept_name)
```

## 12.4 함수적 종속 규칙
| 규칙 | 의미 |
|---|---|
| 포함 규칙 | X가 Y를 포함하면 X → Y는 항상 성립 |
| 분해 규칙 | X → (Y, Z)이면 X → Y, X → Z |
| 합성 규칙 | X → Y, X → Z이면 X → (Y, Z) |
| 이행 규칙 | X → Y, Y → Z이면 X → Z |

주의:
- `(A, B) → C`가 성립한다고 해서 `A → B`나 `B → C`가 성립하는 것은 아님.

## 12.5 키와 함수적 종속
- 테이블의 모든 필드는 키에 함수적으로 종속된다.
- 어떤 필드 X가 나머지 필드들을 함수적으로 결정하면 X는 수퍼키다.
- 결정자가 기본키인 함수적 종속은 DBMS가 기본키 제약으로 비교적 쉽게 보장한다.
- 결정자가 기본키가 아닌 함수적 종속은 유지가 어렵고 중복 문제를 만든다.

## 12.6 정규화
- 불필요한 데이터 중복을 피하기 위해 스키마를 분해하는 과정
- 함수적 종속이 핵심 도구
- 목적: 삽입/삭제/수정 이상 방지

## 12.7 이상현상
| 이상 | 의미 |
|---|---|
| 삽입 이상 | 원하는 데이터를 삽입할 수 없거나 원치 않는 데이터를 함께 삽입해야 하는 문제 |
| 삭제 이상 | 삭제하지 말아야 할 정보까지 함께 삭제되는 문제 |
| 수정 이상 | 중복된 정보 일부만 수정되어 불일치가 발생하는 문제 |

## 12.8 1차 정규형(1NF)
정의:
- 테이블 R의 모든 도메인이 원자값만으로 구성되어 있으면 1NF
- 관계형 데이터 모델을 따르는 테이블은 기본적으로 1NF

문제:
- 1NF만으로는 데이터 중복과 이상현상이 여전히 발생 가능

## 12.9 부분 종속과 2차 정규형(2NF)
### 부분 종속
- 키가 아닌 필드가 복합키 전체가 아니라 키의 일부에만 종속되는 경우

예:
```text
기본키: (stu_id, title)
stu_id → dept_name
```

### 2NF 정의
- 테이블 R에서 키가 아닌 모든 필드가 키에 함수적으로 종속되고,
- 키의 부분집합이 결정자가 되는 부분 종속이 없으면 2NF

특징:
- 기본키가 단일 필드이면 자동으로 2NF
- 부분 종속 제거를 위해 해당 결정자와 종속자를 별도 테이블로 분리

## 12.10 테이블 분해 조건
### 종속성 보존 분해
- 분해 전의 함수적 종속들이 분해 후에도 유지되어야 함.

### 무손실 조인 분해
- 분해된 테이블들을 자연 조인했을 때 원래 테이블이 복원되어야 함.
- 공통 필드 집합이 둘 중 하나의 테이블에서 키가 되면 무손실 조인 분해가 됨.

## 12.11 2NF의 문제와 이행 종속
2NF에서도 다음 문제가 가능:
```text
stu_id → dept_name
dept_name → office
따라서 stu_id → office
```

- `office`가 기본키 `stu_id`에 이행 종속
- 해결: 이행 종속에 참여한 필드들을 별도 테이블로 분해

## 12.12 3차 정규형(3NF)
정의:
- 테이블 R이 2NF이면서,
- 키에 속하지 않은 모든 필드가 기본키에 이행 종속되지 않으면 3NF

## 12.13 3NF의 한계와 BCNF
3NF를 만족해도 이상현상이 발생할 수 있는 경우:
```text
기본키: (stu_id, title)
후보키: (stu_id, prof_name)
함수적 종속:
(stu_id, title) → prof_name
prof_name → title
```

문제 원인:
- 키가 아닌 필드 `prof_name`이 키에 포함되는 필드 `title`을 결정함.

## 12.14 BCNF
정의:
- 테이블 R에 존재하는 모든 함수적 종속에서 결정자가 후보키이면 BCNF

장점:
- 이상현상 방지에 강함

단점:
- 함수적 종속이 보존되지 않을 수 있음

## 12.15 3NF vs BCNF 선택 원칙
| 정규형 | 장점 | 단점 |
|---|---|---|
| 3NF | 무손실 조인 분해, 종속성 보존 | 데이터 중복으로 인한 이상 가능 |
| BCNF | 이상현상 방지 | 종속성 보존 실패 가능 |

선택 원칙:
- 종속성 보존이 매우 중요하다.
- 함수적 종속 보존이 가능하면 BCNF 선택
- 함수적 종속이 보존되지 않으면 3NF 선택

## 12.16 정규화 실습자료
- 예제 1, 예제 2, 예제 3이 정규화 판단/분해 연습 자료로 제공됨.
- 실습 핵심은 주어진 테이블에서 함수적 종속을 찾고, 부분 종속/이행 종속/BCNF 위반을 판단한 뒤 분해하는 것이다.

## 12.17 시험 포인트
- `X → Y` 의미
- 결정자/종속자 구분
- 부분 종속, 이행 종속 구분
- 삽입/삭제/수정 이상 예시 설명
- 1NF/2NF/3NF/BCNF 정의
- 무손실 조인 분해와 종속성 보존 분해
- 3NF와 BCNF의 trade-off

---

# 13주차/13강. 제8장 물리적 저장 구조와 인덱스

## 13.1 핵심 키워드
- 물리적 데이터베이스(physical database)
- HDD
- 파일 시스템
- 파일(file)
- 블록(block)
- 레코드 저장 방식
- 클러스터링(clustering)
- 인덱스(index)
- 순차 검색(sequential scan)
- 인덱스 엔트리(index entry)
- 검색키(search key)
- 주소(address)
- 기본키 인덱스
- B+ 트리
- 차수(order)
- 노드(node)
- 자식 포인터(child pointer)
- 복합 인덱스(composite index)
- 희소 인덱스(sparse index)
- 밀집 인덱스(dense index)
- 클러스터 인덱스(clustered index)
- 비클러스터 인덱스(non-clustered index)
- `create index`
- `create unique index`
- `drop index`

## 13.2 물리적 데이터베이스
- 테이블과 레코드는 HDD에 저장
- 운영체제가 관리하는 파일 시스템 이용
- 기본 저장 구조는 파일
- 입출력 단위는 블록

## 13.3 테이블의 물리적 저장 구조
| 단위 | 의미 |
|---|---|
| 블록 | 하나 이상의 레코드 저장, 각 블록은 하나의 테이블에 속함 |
| 파일 | 하나 이상의 테이블 저장 |

## 13.4 클러스터링
- 자주 검색되는 필드를 기준으로 관련 레코드를 같은 블록에 저장
- 검색 효율을 높이기 위한 물리적 배치 전략

## 13.5 인덱스
- 파일 내 레코드 위치를 빠르게 찾기 위한 별도 구조
- 인덱스가 없으면 순차 검색 필요
- 인덱스 엔트리 구조:
```text
(검색키, 주소)
```
- 검색키는 테이블의 한 개 이상의 필드

## 13.6 SQL과 인덱스 효과
예:
```sql
select *
from student
where dept_id = '920' and address = '서울';
```

- 인덱스 없음: 전체 10,000개 레코드 검색
- `dept_id` 인덱스 있음: `dept_id='920'`인 500개만 우선 검색 가능

조인에서도 인덱스는 검색 비용을 줄인다.

## 13.7 기본키와 인덱스
- 기본키는 검색/삽입/삭제 때 자주 조회됨
- 대부분의 DBMS는 기본키에 대해 자동 인덱스 생성

## 13.8 인덱스 장단점
| 장점 | 단점 |
|---|---|
| 검색 속도 향상 | 삽입/삭제/수정 시 인덱스도 갱신해야 함 |
| 조인 성능 향상 가능 | 인덱스가 많으면 갱신 연산 속도 저하 |

## 13.9 B+ 트리
- RDBMS 인덱스에서 자주 사용되는 자료구조
- 차수 n: 한 노드에서 하위 자식 노드를 가리키는 주소의 개수
- 중간 노드 구조:
```text
P1 Key1 P2 ... Pn-1 Keyn-1 Pn
```
- 검색키 순서에 따라 하위 노드로 이동
- 대량 레코드에서도 트리 높이가 작아 검색이 빠름

## 13.10 복합 인덱스
- 두 개 이상의 필드에 대해 하나의 인덱스 생성
- 엔트리는 검색키 값 순서대로 정렬

예:
```text
검색키: (stu_id, class_id)
```

문자열은 사전식 정렬, 숫자는 크기순 정렬

## 13.11 인덱스 종류
### 대응 밀집도 기준
| 종류 | 의미 |
|---|---|
| 희소 인덱스 | 일부 레코드에 대해서만 인덱스 엔트리 생성 |
| 밀집 인덱스 | 모든 레코드에 대해 인덱스 엔트리 생성 |

### 클러스터링 유무 기준
| 종류 | 의미 |
|---|---|
| 클러스터 인덱스 | 인덱스 엔트리 순서대로 레코드 저장 |
| 비클러스터 인덱스 | 인덱스 엔트리 순서와 관계없이 레코드 저장 |

## 13.12 클러스터 인덱스가 유리한 질의
- 범위 검색
- `order by` 포함 질의

```sql
select name
from student
where stu_id between '1292001' and '1292303';
```

```sql
select grade
from takes
order by grade;
```

## 13.13 인덱스 생성/삭제
```sql
create index <인덱스이름> on <테이블이름> (<필드리스트>);
```

```sql
create index dept_index on department(dept_name);
```

유일 인덱스:
```sql
create unique index dept_index on department(dept_name);
```

복합 인덱스:
```sql
create index student_index2 on student(name, address);
```

삭제:
```sql
drop index <인덱스이름>;
```

## 13.14 인덱스를 만들면 유리한 경우
- 테이블 레코드 수가 많을 때
- `where`절에 자주 사용되는 필드
- 조인 연산에 참여하는 필드
- null이 많은 필드

## 13.15 인덱스를 만들면 불리한 경우
- 테이블 레코드 수가 적을 때
- `where`절에 거의 사용되지 않는 필드
- 삽입/삭제/수정이 자주 발생하는 테이블
- 서로 구별되는 유일 값의 개수가 적은 필드, 예: 성별

## 13.16 시험 포인트
- 인덱스의 목적: 검색 속도 향상
- 인덱스 엔트리 = `(검색키, 주소)`
- 기본키 인덱스 자동 생성
- B+트리 구조와 성능 감각
- 복합 인덱스의 검색키 순서
- 희소/밀집, 클러스터/비클러스터 구분
- 인덱스가 항상 좋은 것은 아님

---

# 14주차/14강. 제9장 트랜잭션(1) — 트랜잭션, ACID, 동시성 제어, 2PL

## 14.1 핵심 키워드
- 트랜잭션(transaction)
- 논리적 작업 단위
- all or nothing
- ACID
- Atomicity
- Consistency
- Isolation
- Durability
- active
- partially committed
- committed
- failed
- aborted
- rollback
- concurrency control
- 단일 사용자 DBMS
- 다중 사용자 DBMS
- `read(x)`
- `write(x)`
- buffer
- schedule
- interleaving
- lost update
- cascading rollback
- inconsistent analysis
- serial schedule
- serializable schedule
- conflict
- locking
- timestamp
- shared lock / S-lock
- exclusive lock / X-lock
- lock / unlock
- 2PL(two-phase locking protocol)
- growing phase
- shrinking phase
- deadlock
- locking granularity

## 14.2 트랜잭션
- 데이터베이스 응용 프로그램에서 업무 처리를 구성하는 논리적 작업 단위
- 데이터베이스 연산(검색/삽입/삭제/수정)의 집합
- 실행 중 멈추거나 중단되지 않는 최소 작업 단위

예: 계좌이체
1. A 계좌 잔액 확인
2. 잔액 충분 여부 확인
3. A 계좌에서 금액 차감
4. B 계좌 잔액 읽기
5. B 계좌에 금액 추가

중간에 멈추면 데이터 불일치 발생 → all or nothing 필요

## 14.3 트랜잭션의 필요성
- 데이터베이스 개발자는 작업 단위를 트랜잭션으로 적절히 정의해야 함.
- 정의된 트랜잭션 사이에서 문제를 막는 것은 DBMS의 역할.

## 14.4 ACID
| 성질 | 의미 |
|---|---|
| Atomicity | 트랜잭션은 모두 성공하거나 모두 실패해야 함 |
| Consistency | 실행 전후 데이터베이스가 일관된 상태여야 함 |
| Isolation | 완료 전 갱신 데이터는 다른 트랜잭션이 참조하지 못해야 함 |
| Durability | 성공적으로 완료된 결과는 영구 저장되어야 함 |

## 14.5 트랜잭션 상태
| 상태 | 의미 |
|---|---|
| active | 트랜잭션이 시작되고 연산이 정상 실행 중 |
| partially committed | 정의된 모든 연산 실행이 끝난 상태 |
| committed | 성공적으로 종료된 상태 |
| failed | 완료되지 못하고 더 이상 실행 불가 |
| aborted | 실패 후 실행 이전 상태로 복귀된 상태 |

상태 흐름:
```text
시작 → active → partially committed → committed → 종료
                 ↘ failed → aborted → rollback
```

## 14.6 동시성 제어
- 다중 사용자 DBMS에서 필요
- 하나의 트랜잭션이 완료되지 않은 상태에서 다른 트랜잭션이 실행될 수 있음
- 트랜잭션 간 간섭으로 일관성이 깨지지 않도록 제어

## 14.7 트랜잭션 연산
| 연산 | 의미 | SQL 대응 |
|---|---|---|
| `read(x)` | DB 항목 x를 지역변수 x로 읽음 | `select` |
| `write(x)` | 지역변수 x 값을 DB 항목 x에 저장 | `update` |

주의:
- `write(x)` 결과가 디스크에 즉시 저장될 수도, 버퍼에만 남을 수도 있음.

## 14.8 스케줄
- 트랜잭션 명령들이 끼어들기 방식으로 실행되는 순서
- 스케줄은 운영체제/DBMS 실행 흐름에 따라 결정되므로 사용자가 예측하기 어려움

## 14.9 끼어들기로 인한 문제
### 갱신 분실(lost update)
- 한 트랜잭션의 갱신이 다른 트랜잭션의 갱신에 의해 사라짐

### 연쇄 복귀(cascading rollback)
- 아직 commit되지 않은 데이터를 다른 트랜잭션이 읽었고,
- 원래 트랜잭션이 rollback되면 읽은 트랜잭션도 rollback해야 함
- 이미 commit했다면 지속성 위배 가능

### 불일치 분석(inconsistent analysis)
- 끼어들기 때문에 트랜잭션이 일관되지 않은 중간 상태를 읽음

## 14.10 직렬 스케줄과 직렬 가능 스케줄
| 개념 | 의미 |
|---|---|
| 직렬 스케줄 | 트랜잭션들이 끼어들기 없이 순차적으로 실행 |
| 직렬 가능 스케줄 | 끼어들기는 있지만 실행 결과가 어떤 직렬 스케줄과 동일 |

동시성 제어의 목표:
- 병행 실행을 최대한 허용하면서도 직렬 가능 스케줄을 보장

## 14.11 연산 교환 가능성
- 서로 다른 데이터 항목에 대한 read/write는 교환 가능
- 같은 데이터 항목에 대한 read-read는 교환 가능
- 같은 데이터 항목에서 하나라도 write가 있으면 교환 불가능

## 14.12 직렬 가능하게 만드는 방법
- 잠금(locking): 실행 순서를 강제로 제어
- 타임스탬프(timestamp): 병행 수행을 최대한 보장하되 직렬 가능성 위배 시 취소
- 대부분 DBMS는 잠금 기법 사용

## 14.13 잠금
- 특정 데이터 항목에 대해 다른 트랜잭션의 동시 접근을 방지
- 잠금이 걸린 데이터는 잠금을 실행한 트랜잭션이 독점적/제한적으로 접근

## 14.14 잠금 종류
| 잠금 | 의미 |
|---|---|
| S-lock | 공유잠금. read 가능, write 불가. 여러 트랜잭션이 동시에 S-lock 가능 |
| X-lock | 배타잠금. read/write 모두 가능. 하나의 데이터에 하나만 가능 |

동시 가능 여부:
|  | S-lock | X-lock |
|---|---:|---:|
| S-lock | 가능 | 불가능 |
| X-lock | 불가능 | 불가능 |

규칙:
- `read(x)` 전에는 S-lock 또는 X-lock 필요
- `write(x)` 전에는 X-lock 필요
- 연산 후 `unlock(x)`
- lock 후에만 unlock 가능

## 14.15 2단계 잠금 규약(2PL)
- 단순 잠금만으로는 직렬 가능성을 보장하지 못함.
- 2PL은 잠금 획득 단계와 해제 단계를 분리해 직렬 가능성을 보장한다.

개념:
1. Growing phase: lock 획득 가능, unlock 불가
2. Shrinking phase: unlock 가능, 새로운 lock 획득 불가

한계:
- 직렬 가능성은 보장하지만 deadlock 가능
- 잠금 단위가 클수록 충돌이 많고, 작을수록 관리 비용이 큼

## 14.16 잠금 단위
- 테이블, 레코드, 필드 등 다양한 granularity 가능
- 큰 단위: 관리 쉬움, 병행성 낮음
- 작은 단위: 병행성 높음, 관리 비용 큼

## 14.17 시험 포인트
- 트랜잭션 정의와 ACID
- 트랜잭션 상태 전이
- lost update / cascading rollback / inconsistent analysis
- serial vs serializable
- S-lock/X-lock 차이와 동시 가능 표
- 2PL의 두 단계와 한계

---

# 15주차/15강. 제9장 트랜잭션(2) — 장애, 로그, 복구, Oracle 트랜잭션

## 15.1 핵심 키워드
- 장애(failure)
- 복구(recovery)
- 트랜잭션 장애
- 시스템 장애
- 미디어 장애
- redundancy
- backup
- mirroring
- log
- 비휘발성 저장장치
- `<T start>`
- `<T commit>`
- `<T abort>`
- `<T, x, v1, v2>`
- write-ahead logging protocol
- WAL
- UNDO
- REDO
- deferred database modification
- immediate database modification
- NO-UNDO/REDO
- UNDO/REDO
- checkpoint
- commit
- rollback
- autocommit
- savepoint

## 15.2 장애 종류
| 장애 | 의미 |
|---|---|
| 트랜잭션 장애 | 논리 오류, 잘못된 입력, 자원 부족으로 트랜잭션 중단 |
| 시스템 장애 | 정전, 하드웨어 결함 등으로 시스템 작동 중단 |
| 미디어 장애 | 디스크 등 저장장치 일부/전체 손상 |

## 15.3 복구
- 장애 발생 이전의 일관된 상태로 데이터베이스를 복원
- 기본 원리는 데이터 중복성(redundancy)
- 예: backup, mirroring

## 15.4 미디어 장애 대처
- 백업 파일 사용
- Mirroring: DB를 서로 다른 디스크에 복제해 하나가 고장 나도 계속 운용

## 15.5 트랜잭션/시스템 장애 대처
- 어떤 순서로 갱신이 이루어졌는지 기록해야 복구 가능
- 이 기록이 로그(log)
- 로그는 비휘발성 저장장치에 보관

## 15.6 로그 구성 요소
| 로그 레코드 | 의미 |
|---|---|
| `<T start>` | 트랜잭션 시작 |
| `<T commit>` | 트랜잭션 완료 |
| `<T abort>` | 트랜잭션 중단 |
| `<T, x, v1, v2>` | T가 x를 v1에서 v2로 변경 |

## 15.7 로그 우선 기록 규약(WAL)
- 데이터 항목을 디스크에 기록하기 전에 로그 레코드를 먼저 기록해야 함.
- 이유: 이미 기록된 변경 내용을 취소하거나 재실행하려면 로그가 먼저 남아 있어야 함.
- 완료된 트랜잭션 변경이 버퍼에만 남아 있다가 장애가 나도, commit 로그가 있으면 복구 가능.

## 15.8 UNDO와 REDO
| 연산 | 의미 |
|---|---|
| UNDO | 갱신된 값을 이전 상태로 되돌림 |
| REDO | 갱신을 다시 실행 |

## 15.9 지연 갱신 기반 복구
- 트랜잭션이 성공적으로 끝난 후 갱신 내용을 디스크에 반영
- 완료 전에는 주기억장치 버퍼에만 저장

진행:
1. `<T start>` 기록
2. write 수행 시 로그 기록 후 버퍼에 변경값 저장
3. 모든 연산 종료 후 부분 완료 상태
4. `<T commit>`이 로그에 기록되면 완료
5. 이후 적절한 시기에 버퍼 내용을 디스크에 저장

### 완료의 의미
- 트랜잭션 완료 = 디스크 로그에 `<T commit>`이 기록된 상태
- commit 로그가 없으면 완료인지 실행 중 중단인지 알 수 없음

### 복구 알고리즘
- UNDO 불필요
- REDO 필요
- 로그 형식: `<T, x, v2>`
- 로그 처음부터 순차 검색
- `<T commit>`이 있으면 REDO
- commit 없는 트랜잭션은 무시
- 이름: **NO-UNDO/REDO**

## 15.10 즉시 갱신 기반 복구
- 트랜잭션 실행 도중, commit 전에도 버퍼의 갱신 데이터가 디스크에 저장될 수 있음
- 로그 형식: `<T, x, v1, v2>`

복구 과정:
1. 로그 마지막부터 역방향 검색
2. `<T start>`는 있으나 `<T commit>`이 없으면 UNDO
3. 이후 로그 처음부터 정방향 검색
4. `<T commit>`이 있는 트랜잭션은 REDO
- 이름: **UNDO/REDO**

## 15.11 검사점(checkpoint)
- 복구할 때 전체 로그를 모두 조사하면 비용이 큼
- 일정 시점에 checkpoint를 기록해 복구 범위를 줄임
- checkpoint 이후의 로그 중심으로 복구 가능

## 15.12 Oracle에서의 트랜잭션
- `commit`: 현재 트랜잭션의 변경 내용을 완료
- `rollback`: 현재 트랜잭션의 변경 내용을 취소
- 자동 완료/자동 복귀 상황 존재
- `set autocommit on`: 각 SQL문 실행 후 자동 commit

## 15.13 저장점(savepoint)
- 트랜잭션 전체가 아니라 특정 지점까지만 되돌릴 수 있게 함

```sql
savepoint <저장점이름>;
rollback to <저장점이름>;
```

## 15.14 시험 포인트
- 장애 세 종류
- 로그 구성 요소
- WAL의 본질: 데이터보다 로그 먼저
- commit의 의미: 디스크 로그에 `<T commit>` 기록
- 지연 갱신 = NO-UNDO/REDO
- 즉시 갱신 = UNDO/REDO
- checkpoint 목적
- Oracle `commit`, `rollback`, `autocommit`, `savepoint`

---

# 16주차/참고강의. 트랜잭션 격리 수준 Isolation Level

## 16.1 핵심 키워드
- Isolation Level
- Read Uncommitted
- Read Committed
- Repeatable Read
- Serializable
- Dirty Read
- Non-Repeatable Read
- Phantom Read
- MVCC
- Undo 영역
- Shared Lock
- Exclusive Lock
- 정확성 vs 성능 trade-off
- Oracle 기본 격리 수준
- MySQL InnoDB 기본 격리 수준

## 16.2 격리 수준이 필요한 이유
- ACID의 Isolation을 100% 강하게 보장하면 정확성은 높지만 모든 트랜잭션이 순차 실행되어 성능이 낮아짐.
- 격리 수준은 정확성과 성능 사이의 trade-off를 조절하는 장치.

정확성/성능 감각:
```text
SERIALIZABLE      정확성 최고 | 성능 최저
REPEATABLE READ   정확성 높음 | 성능 낮음
READ COMMITTED    정확성 낮음 | 성능 높음
READ UNCOMMITTED  정확성 최저 | 성능 최고
```

## 16.3 이상현상
| 이상현상 | 의미 |
|---|---|
| Dirty Read | 아직 commit되지 않은 다른 트랜잭션의 데이터를 읽음 |
| Non-Repeatable Read | 같은 트랜잭션 안에서 같은 쿼리를 두 번 실행했는데 결과가 달라짐 |
| Phantom Read | 같은 범위 조건 쿼리를 두 번 실행했는데 새 레코드가 나타남 |

## 16.4 Read Uncommitted
- 가장 낮은 격리 수준
- 다른 트랜잭션이 commit하지 않은 데이터도 읽을 수 있음
- Dirty Read 발생 가능
- Oracle은 지원하지 않음
- 속도와 동시성은 최고지만 정합성 보장 불가

## 16.5 Read Committed
- commit된 데이터만 읽음
- Dirty Read 차단
- Oracle 기본 격리 수준
- 변경 중인 데이터는 Undo 영역의 이전값을 읽음
- MVCC 기반 동작
- Non-Repeatable Read와 Phantom Read는 발생 가능

## 16.6 Repeatable Read
- 트랜잭션 내 같은 쿼리는 항상 같은 결과를 보장
- Dirty Read, Non-Repeatable Read 차단
- Undo 영역에 스냅샷처럼 데이터 관리
- MySQL InnoDB 기본 격리 수준
- 표준적으로 Phantom Read 가능

## 16.7 Serializable
- 가장 높은 격리 수준
- 순차 실행과 결과가 항상 같음
- 모든 이상현상 차단
- SELECT 시 Shared Lock
- INSERT/UPDATE/DELETE 시 Exclusive Lock
- 정확성은 최고지만 성능 저하, deadlock 위험, 실무 사용 제한

## 16.8 격리 수준별 이상현상 비교
| 격리 수준 | Dirty Read | Non-Repeatable Read | Phantom Read | 처리속도 |
|---|---|---|---|---|
| READ UNCOMMITTED | 허용 | 허용 | 허용 | 매우 빠름 |
| READ COMMITTED | 차단 | 허용 | 허용 | 빠름 |
| REPEATABLE READ | 차단 | 차단 | 허용 가능 | 중간 |
| SERIALIZABLE | 차단 | 차단 | 차단 | 느림 |

## 16.9 실무 선택 감각
| 상황 | 적절한 수준 |
|---|---|
| 정확하지 않아도 되는 대량 통계/분석 | Read Uncommitted 가능하나 실무에서는 주의 |
| 일반 웹서비스 | Read Committed |
| 트랜잭션 내 일관된 조회 중요 | Repeatable Read |
| 금융/재고 등 절대 정합성 중요 | Serializable 또는 명시적 잠금/비즈니스 제약 병행 |

## 16.10 시험 포인트
- 네 격리 수준의 순서
- Dirty/Non-Repeatable/Phantom Read 정의
- Oracle 기본값: Read Committed
- MySQL InnoDB 기본값: Repeatable Read
- Serializable은 정확성 최고, 성능 최저

---

# 전체 암기 지도

## A. 핵심 흐름 한 줄 요약
```text
데이터 → 관계형 모델 → SQL → 무결성/보안 → ERD 변환 → 정규화 → 물리 저장/인덱스 → 트랜잭션/동시성/복구
```

## B. 시험 직전 최우선 암기 키워드
1. relation / attribute / tuple / domain / schema / instance
2. super key / candidate key / primary key / foreign key
3. selection / projection / rename / union / minus / cartesian product / join
4. SQL DDL/DML: create, alter, drop, insert, update, delete, select
5. join: inner, outer, left/right/full, natural, cross
6. aggregate: count, sum, avg, min, max, group by, having
7. null: is null, is not null, count(*) 차이
8. nested query: in, not in, some/any, all, exists, not exists
9. view: 가상 테이블, 보안, 질의 단순화, read only
10. integrity: primary key, foreign key, not null, unique, check, default
11. security: grant, revoke, role, with grant option
12. ERD 변환: 강성, 약성, 다대일, 다대다, 일대일, 다중값, 복합속성, 일반화, 대리키
13. functional dependency: determinant, dependent, partial, transitive
14. normalization: 1NF, 2NF, 3NF, BCNF, 무손실 조인, 종속성 보존
15. index: B+ tree, composite, clustered/non-clustered, sparse/dense
16. transaction: ACID, schedule, serializable, locking, S-lock, X-lock, 2PL
17. recovery: log, WAL, UNDO, REDO, deferred/immediate update, checkpoint
18. isolation level: Read Uncommitted, Read Committed, Repeatable Read, Serializable

## C. 헷갈리기 쉬운 비교표

### DELETE vs DROP
| 명령 | 대상 | 결과 |
|---|---|---|
| `delete` | 레코드 | 데이터만 삭제, 테이블 남음 |
| `drop table` | 테이블 | 테이블 구조까지 삭제 |

### WHERE vs HAVING
| 절 | 조건 대상 |
|---|---|
| `where` | 개별 레코드 |
| `having` | 그룹화된 결과 |

### COUNT(*) vs COUNT(field)
| 표현 | 의미 |
|---|---|
| `count(*)` | 레코드 수, null 영향 없음 |
| `count(field)` | 해당 필드가 null이 아닌 값의 수 |

### INNER JOIN vs OUTER JOIN
| JOIN | 결과 |
|---|---|
| Inner join | 양쪽 조건이 맞는 레코드만 |
| Outer join | 조건이 안 맞아도 한쪽/양쪽 레코드 보존 |

### 3NF vs BCNF
| 정규형 | 핵심 조건 | trade-off |
|---|---|---|
| 3NF | 비키 속성이 기본키에 이행 종속되지 않음 | 종속성 보존 유리 |
| BCNF | 모든 함수 종속의 결정자가 후보키 | 이상 방지 유리, 종속성 보존 실패 가능 |

### 지연 갱신 vs 즉시 갱신
| 방식 | commit 전 디스크 반영 | 복구 |
|---|---|---|
| 지연 갱신 | 안 함 | NO-UNDO/REDO |
| 즉시 갱신 | 가능 | UNDO/REDO |

### S-lock vs X-lock
| 잠금 | 읽기 | 쓰기 | 여러 트랜잭션 동시 가능 |
|---|---|---|---|
| S-lock | 가능 | 불가 | 가능 |
| X-lock | 가능 | 가능 | 불가 |

---

# 자료별 커버리지 체크리스트

- [x] 강의소개.pdf
- [x] 제 01 장 데이터와 데이터베이스.pdf
- [x] 제 02 장 관계형 데이터베이스.pdf
- [x] 제 03 장 오라클 개요 - 구조.pdf
- [x] 제 03 장 실습참고자료.pdf
- [x] 제 04 장 SQL(1).pdf
- [x] 제 04 장 SQL(2).pdf
- [x] 제 04 장 SQL(3-1 join).pdf
- [x] 제 04 장 SQL(3-2 aggregate function).pdf
- [x] 제 04 장 SQL(4 nested query view).pdf
- [x] 제 05 장 무결성과 보안.pdf
- [x] 제 06 장 데이터베이스 설계(2).pdf
- [x] 제 07 장 함수적종속과 정규화.pdf
- [x] 정규화 실습자료.pdf
- [x] 제 08 장 물리적 저장구조와 인덱스.pdf
- [x] 제 09 장 트랜잭션(1).pdf
- [x] 제 09 장 트랜잭션(2).pdf
- [x] 참고자료 Isolation_Level.pdf

---

# 마지막 정리: 이 과목의 로고스

데이터베이스 과목의 핵심 구조는 하나다.

> **현실의 모호한 정보를, 중복과 모순이 적은 구조로 모델링하고, SQL로 조작하며, 동시에 여러 사용자가 접근하고 장애가 발생해도 일관성과 지속성을 유지하는 시스템을 이해하는 것.**

즉, 단순 암기보다 다음 질문에 답할 수 있어야 한다.

1. 이 데이터는 어떤 테이블 구조로 표현되어야 하는가?
2. 이 질의는 관계대수/SQL로 어떻게 표현되는가?
3. 이 구조에는 중복과 이상현상이 있는가?
4. 이 제약은 DBMS가 보장해야 하는가, 응용 프로그램이 보장해야 하는가?
5. 이 검색은 인덱스로 빨라질 수 있는가?
6. 동시에 실행되면 어떤 문제가 생기는가?
7. 장애가 나면 로그를 보고 무엇을 UNDO/REDO 해야 하는가?

이 7개 질문이 연결되면 강의 전체가 하나의 구조로 잡힌다.
