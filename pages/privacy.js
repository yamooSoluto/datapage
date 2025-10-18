export default function Privacy() {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            개인정보처리방침
          </h1>
  
          <div className="prose prose-gray max-w-none text-gray-800 leading-relaxed overflow-y-auto max-h-[75vh] px-2">
            <p>
              주식회사 솔루투(이하 ‘회사’)는 고객님의 개인정보를 중요시하며, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」을 준수합니다.
            </p>
            <p>
              본 개인정보처리방침을 통해 회사가 수집하는 개인정보의 항목과 이용 목적, 보유 및 파기 절차, 제3자 제공, 위탁, 권리 행사 방법 등을 안내드립니다.
            </p>
            <p>
              회사는 개인정보처리방침을 개정하는 경우 웹사이트 공지사항(또는 개별공지)을 통하여 공지할 것입니다.
            </p>
  
            <h2>■ 수집하는 개인정보 항목</h2>
            <p>회사는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집합니다.</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>수집항목: 이름, 생년월일, 성별, 로그인ID, 비밀번호, 주소, 휴대전화번호, 이메일, 법정대리인 정보, 주민등록번호, 서비스 이용기록, 접속 로그, 접속 IP 정보, 결제기록, 암호화된 이용자 확인값(CI)</li>
              <li>수집방법: 홈페이지(회원가입), 서면양식</li>
            </ul>
  
            <h2>■ 개인정보의 수집 및 이용 목적</h2>
            <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>사이트 회원 가입 및 관리: 본인확인, 서비스 이용 및 상담, 공지사항 전달, 간편로그인 서비스 제공</li>
              <li>재화 또는 서비스 제공: 물품배송, 콘텐츠 제공, 정산 및 환불</li>
              <li>마케팅 및 광고: 접속빈도 분석, 이벤트 및 광고성 정보 전달</li>
              <li>호스팅사 이전 시 회원정보 이관 처리</li>
            </ol>
            <p>
              * 서비스 이용 중 생성되는 정보: 이용기록, 방문기록, 불량 이용기록, IP주소, 쿠키, 광고식별자 등은 자동으로 수집될 수 있습니다.
            </p>
            <p>
              * 이벤트 참여 시 별도 동의를 받아 추가 항목을 수집할 수 있으며, 목적 달성 즉시 파기됩니다.
            </p>
  
            <h2>■ 개인정보의 보유 및 이용기간</h2>
            <p>
              회사는 개인정보 수집 및 이용목적이 달성된 후에는 예외 없이 해당 정보를 지체 없이 파기합니다.
            </p>
  
            <h2>■ 개인정보의 파기절차 및 방법</h2>
            <p>회사는 원칙적으로 개인정보 이용목적이 달성된 후에는 해당 정보를 지체없이 파기합니다.</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>파기절차:</strong> 회원가입 등을 위해 입력하신 정보는 목적이 달성된 후 별도의 DB로 옮겨져 내부 방침 및 관련 법령에 따라 일정 기간 저장 후 파기됩니다.
              </li>
              <li>
                <strong>파기방법:</strong> 전자적 파일 형태의 개인정보는 복구 불가능한 기술적 방법으로 삭제합니다.
              </li>
            </ul>
  
            <h2>■ 개인정보 제공</h2>
            <p>회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 다음의 경우 예외로 합니다.</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>이용자 동의가 있는 경우</li>
              <li>법령에 의거하거나 수사기관의 요청이 있는 경우</li>
            </ul>
  
            <h2>■ 제3자 제공 및 개인정보 처리 위탁</h2>
            <p>회사는 보다 나은 서비스 제공을 위해 아래와 같이 일부 업무를 외부 전문업체에 위탁하고 있습니다.</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>전산 시스템 구축 및 유지: (주)아임웹</li>
              <li>카카오알림톡/문자 발송: (주)아임웹, (주)써머스플랫폼</li>
              <li>본인확인: KG이니시스</li>
              <li>결제 및 에스크로 서비스: 나이스페이먼츠</li>
            </ul>
            <p className="mt-2 text-sm">
              ※ 수탁자에 제공되는 정보는 필요한 최소한의 정보에 한정되며, 계약 변경 시 공지를 통해 안내됩니다.
            </p>
  
            <h2>■ 14세 미만 아동의 개인정보 보호</h2>
            <p>회사는 법정대리인의 동의가 필요한 만 14세 미만 아동의 회원가입을 받지 않습니다.</p>
  
            <h2>■ 개인정보 자동수집 장치의 설치, 운영 및 거부</h2>
            <p>
              회사는 이용자의 정보를 저장하고 찾아내는 ‘쿠키(cookie)’를 사용합니다. 쿠키는 웹사이트 이용 편의를 높이기 위해 사용되며,
              사용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.
            </p>
            <p>
              <strong>쿠키 거부 방법:</strong> 웹 브라우저 상단 메뉴 → 도구 → 인터넷 옵션 → 개인정보 설정
            </p>
            <p>단, 쿠키를 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</p>
  
            <h2>■ 개인정보에 관한 민원서비스</h2>
            <p>
              회사는 개인정보 보호 및 관련 불만 처리를 위해 아래와 같이 개인정보관리책임자를 지정하고 있습니다.
            </p>
            <ul className="list-disc ml-6">
              <li>개인정보관리책임자 성명: 김채윤</li>
              <li>전화번호: 070-4138-0625</li>
              <li>이메일: soluto@soluto.dooray.com</li>
            </ul>
  
            <h2>■ 개인정보침해 관련 외부 신고 기관</h2>
            <ol className="list-decimal ml-6 space-y-1">
              <li>대검찰청 사이버수사과: <a href="https://cybercid.spo.go.kr" target="_blank" className="text-indigo-600">cybercid.spo.go.kr</a></li>
              <li>경찰청 사이버테러대응센터: <a href="https://www.ctrc.go.kr" target="_blank" className="text-indigo-600">www.ctrc.go.kr</a> / 02-392-0330</li>
              <li>개인정보침해신고센터: <a href="https://privacy.kisa.or.kr" target="_blank" className="text-indigo-600">privacy.kisa.or.kr</a> / 국번 없이 118</li>
              <li>개인정보분쟁조정위원회: <a href="https://www.kopico.go.kr" target="_blank" className="text-indigo-600">kopico.go.kr</a> / 1833-6972</li>
            </ol>
  
            <h2>■ 개인정보처리방침의 개정과 공지</h2>
            <p>
              본 방침을 개정하는 경우 시행 7일 전(중대한 변경 시 30일 전) 홈페이지 또는 이메일을 통해 공지합니다.
            </p>
  
            <div className="mt-10 border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-500 text-right">
                시행일자: 2025년 10월 18일
              </p>
            </div>
          </div>
  
          <div className="mt-10 text-center">
            <a href="/" className="text-indigo-600 hover:text-indigo-700">
              ← 메인으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    );
  }
  