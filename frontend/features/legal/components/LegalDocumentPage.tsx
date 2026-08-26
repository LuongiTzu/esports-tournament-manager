"use client";

import Link from "next/link";
import {
  FileTextIcon,
  FingerprintIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { useLocale } from "@/features/locale/store";
import type { Locale } from "@/features/locale/types";

export type LegalDocumentKind = "terms" | "privacy" | "personal-data";

interface LegalSection {
  title: string;
  paragraphs: string[];
  items?: string[];
}

interface LegalDocument {
  eyebrow: string;
  title: string;
  introduction: string;
  updatedLabel: string;
  updatedAt: string;
  sections: LegalSection[];
}

const documents: Record<Locale, Record<LegalDocumentKind, LegalDocument>> = {
  vi: {
    terms: {
      eyebrow: "Thông tin pháp lý",
      title: "Điều khoản sử dụng",
      introduction:
        "Điều khoản này quy định việc truy cập và sử dụng nền tảng quản lý giải đấu ArenaVerse. Khi tạo tài khoản hoặc tiếp tục sử dụng nền tảng, bạn xác nhận đã đọc và đồng ý với các nội dung dưới đây.",
      updatedLabel: "Cập nhật lần cuối",
      updatedAt: "26/08/2026",
      sections: [
        {
          title: "1. Tài khoản và trách nhiệm người dùng",
          paragraphs: [
            "Bạn phải cung cấp thông tin chính xác, giữ bí mật thông tin đăng nhập và chịu trách nhiệm với hoạt động phát sinh từ tài khoản của mình. Hãy thông báo cho đơn vị vận hành khi phát hiện truy cập trái phép.",
          ],
        },
        {
          title: "2. Tổ chức và tham gia giải đấu",
          paragraphs: [
            "Ban tổ chức chịu trách nhiệm về nội dung, thể lệ, lịch thi đấu và quyết định vận hành của giải do mình tạo. Người tham gia có trách nhiệm tuân thủ thể lệ được công bố và cung cấp thông tin đội chính xác.",
          ],
        },
        {
          title: "3. Hành vi không được phép",
          paragraphs: ["Bạn không được sử dụng ArenaVerse để:"],
          items: [
            "Mạo danh, gian lận kết quả hoặc can thiệp trái phép vào giải đấu.",
            "Đăng nội dung bất hợp pháp, xúc phạm, quấy rối hoặc xâm phạm quyền của người khác.",
            "Phát tán mã độc, khai thác lỗ hổng hoặc gây gián đoạn hoạt động của hệ thống.",
            "Thu thập dữ liệu của người dùng khác khi chưa có căn cứ hoặc sự đồng ý phù hợp.",
          ],
        },
        {
          title: "4. Nội dung và xử lý vi phạm",
          paragraphs: [
            "Bạn giữ trách nhiệm đối với nội dung mình cung cấp. ArenaVerse có thể ẩn nội dung, giới hạn chức năng hoặc khóa tài khoản khi có căn cứ cho rằng điều khoản, thể lệ giải đấu hoặc pháp luật bị vi phạm.",
          ],
        },
        {
          title: "5. Thay đổi và gián đoạn dịch vụ",
          paragraphs: [
            "Nền tảng có thể được cập nhật để cải thiện tính năng, bảo mật hoặc đáp ứng yêu cầu vận hành. Một số chức năng có thể tạm thời gián đoạn trong quá trình bảo trì. Phiên bản điều khoản mới sẽ được công bố tại trang này.",
          ],
        },
      ],
    },
    privacy: {
      eyebrow: "Thông tin pháp lý",
      title: "Chính sách bảo mật",
      introduction:
        "Chính sách này giải thích cách ArenaVerse bảo vệ hệ thống và xử lý dữ liệu phát sinh khi bạn truy cập, đăng nhập và sử dụng các chức năng quản lý giải đấu.",
      updatedLabel: "Cập nhật lần cuối",
      updatedAt: "26/08/2026",
      sections: [
        {
          title: "1. Dữ liệu kỹ thuật được xử lý",
          paragraphs: [
            "Hệ thống có thể xử lý thông tin phiên đăng nhập, yêu cầu API, thời điểm truy cập, loại thiết bị hoặc trình duyệt và dữ liệu lỗi cần thiết để duy trì hoạt động, phát hiện gian lận và bảo vệ tài khoản.",
          ],
        },
        {
          title: "2. Lưu trữ trên thiết bị",
          paragraphs: [
            "ArenaVerse sử dụng bộ nhớ cục bộ của trình duyệt để duy trì phiên đăng nhập, lựa chọn ngôn ngữ và giao diện. Bạn có thể xóa dữ liệu này trong cài đặt trình duyệt; thao tác đó có thể đăng xuất tài khoản hoặc đặt lại tùy chọn.",
          ],
        },
        {
          title: "3. Bảo vệ thông tin",
          paragraphs: [
            "Chúng tôi áp dụng các biện pháp kỹ thuật và phân quyền phù hợp để hạn chế truy cập trái phép, thay đổi, tiết lộ hoặc mất dữ liệu. Không phương thức truyền hay lưu trữ điện tử nào có thể bảo đảm an toàn tuyệt đối.",
          ],
        },
        {
          title: "4. Liên kết và dịch vụ bên ngoài",
          paragraphs: [
            "Nội dung giải đấu có thể chứa liên kết hoặc hình ảnh từ dịch vụ bên ngoài. Chính sách của ArenaVerse không kiểm soát cách các dịch vụ đó thu thập hoặc xử lý dữ liệu của bạn.",
          ],
        },
        {
          title: "5. Cập nhật chính sách",
          paragraphs: [
            "Chính sách có thể được điều chỉnh khi tính năng, biện pháp bảo mật hoặc yêu cầu pháp lý thay đổi. Ngày cập nhật mới nhất luôn được hiển thị ở đầu trang.",
          ],
        },
      ],
    },
    "personal-data": {
      eyebrow: "Thông tin pháp lý",
      title: "Chính sách bảo mật thông tin cá nhân",
      introduction:
        "Tài liệu này mô tả cụ thể loại thông tin cá nhân ArenaVerse tiếp nhận, mục đích sử dụng và quyền của bạn đối với dữ liệu gắn với tài khoản.",
      updatedLabel: "Cập nhật lần cuối",
      updatedAt: "26/08/2026",
      sections: [
        {
          title: "1. Thông tin được thu thập",
          paragraphs: ["Tùy cách bạn sử dụng nền tảng, dữ liệu có thể bao gồm:"],
          items: [
            "Thông tin tài khoản: email, tên hiển thị và ảnh đại diện.",
            "Thông tin hồ sơ tự nguyện: ngày sinh, giới tính, số điện thoại, địa chỉ hiện tại và phần giới thiệu.",
            "Thông tin giải đấu và đội: vai trò tổ chức, đăng ký đội, thành viên, lịch đấu và kết quả.",
            "Thông tin vận hành và bảo mật liên quan đến phiên đăng nhập và hoạt động tài khoản.",
          ],
        },
        {
          title: "2. Mục đích xử lý",
          paragraphs: [
            "Dữ liệu được dùng để tạo và xác thực tài khoản, hiển thị hồ sơ, vận hành đăng ký và giải đấu, gửi thông báo liên quan, hỗ trợ người dùng, kiểm duyệt nội dung và bảo vệ an toàn hệ thống.",
          ],
        },
        {
          title: "3. Phạm vi hiển thị và chia sẻ",
          paragraphs: [
            "Tên hiển thị, ảnh đại diện và thông tin bạn chủ động đưa vào nội dung công khai có thể được người dùng khác nhìn thấy. Các dữ liệu còn lại chỉ được truy cập trong phạm vi cần thiết cho chức năng, quản trị hệ thống hoặc khi pháp luật yêu cầu.",
          ],
        },
        {
          title: "4. Thời gian lưu giữ",
          paragraphs: [
            "Thông tin được lưu trong thời gian tài khoản hoạt động hoặc khi cần thiết để cung cấp dịch vụ, giải quyết tranh chấp, bảo đảm an toàn và đáp ứng nghĩa vụ áp dụng. Dữ liệu có thể được xóa hoặc ẩn danh khi không còn cần thiết.",
          ],
        },
        {
          title: "5. Quyền của bạn",
          paragraphs: [
            "Bạn có thể xem và chỉnh sửa các trường hồ sơ được hỗ trợ ngay tại trang Thông tin cá nhân. Đối với yêu cầu truy cập, sửa, hạn chế xử lý hoặc xóa dữ liệu ngoài phạm vi tự phục vụ, hãy liên hệ đơn vị vận hành ArenaVerse qua kênh hỗ trợ chính thức.",
          ],
        },
      ],
    },
  },
  en: {
    terms: {
      eyebrow: "Legal information",
      title: "Terms of use",
      introduction:
        "These terms govern access to and use of the ArenaVerse tournament management platform. By creating an account or continuing to use the platform, you acknowledge and accept the terms below.",
      updatedLabel: "Last updated",
      updatedAt: "August 26, 2026",
      sections: [
        {
          title: "1. Accounts and user responsibilities",
          paragraphs: [
            "You must provide accurate information, protect your credentials, and take responsibility for activity under your account. Notify the operator if you discover unauthorized access.",
          ],
        },
        {
          title: "2. Organizing and joining tournaments",
          paragraphs: [
            "Organizers are responsible for the content, rules, schedule, and operational decisions of tournaments they create. Participants must follow published rules and provide accurate team information.",
          ],
        },
        {
          title: "3. Prohibited conduct",
          paragraphs: ["You may not use ArenaVerse to:"],
          items: [
            "Impersonate others, falsify results, or interfere with tournaments.",
            "Post unlawful, abusive, harassing, or rights-infringing content.",
            "Distribute malware, exploit vulnerabilities, or disrupt the platform.",
            "Collect another user's data without an appropriate basis or consent.",
          ],
        },
        {
          title: "4. Content and enforcement",
          paragraphs: [
            "You remain responsible for content you submit. ArenaVerse may hide content, restrict functionality, or lock accounts when there is reason to believe these terms, tournament rules, or applicable law have been violated.",
          ],
        },
        {
          title: "5. Service changes and interruptions",
          paragraphs: [
            "The platform may be updated for features, security, or operational requirements. Some functionality may be temporarily unavailable during maintenance. Updated terms will be published on this page.",
          ],
        },
      ],
    },
    privacy: {
      eyebrow: "Legal information",
      title: "Privacy policy",
      introduction:
        "This policy explains how ArenaVerse protects the platform and handles data generated when you browse, sign in, and use tournament management features.",
      updatedLabel: "Last updated",
      updatedAt: "August 26, 2026",
      sections: [
        {
          title: "1. Technical data",
          paragraphs: [
            "The system may process session information, API requests, access times, device or browser type, and error data needed to operate the service, detect abuse, and protect accounts.",
          ],
        },
        {
          title: "2. Device storage",
          paragraphs: [
            "ArenaVerse uses browser local storage to maintain your session, language, and theme choices. You can clear this data in your browser settings, which may sign you out or reset preferences.",
          ],
        },
        {
          title: "3. Information security",
          paragraphs: [
            "We apply appropriate technical controls and access restrictions to reduce unauthorized access, alteration, disclosure, or loss. No electronic transmission or storage method can guarantee absolute security.",
          ],
        },
        {
          title: "4. External links and services",
          paragraphs: [
            "Tournament content may include links or images from external services. ArenaVerse does not control how those services collect or process your information.",
          ],
        },
        {
          title: "5. Policy updates",
          paragraphs: [
            "This policy may change as features, security measures, or legal requirements evolve. The latest update date is always shown at the top of this page.",
          ],
        },
      ],
    },
    "personal-data": {
      eyebrow: "Legal information",
      title: "Personal information privacy policy",
      introduction:
        "This document describes the personal information ArenaVerse receives, why it is used, and your choices regarding data associated with your account.",
      updatedLabel: "Last updated",
      updatedAt: "August 26, 2026",
      sections: [
        {
          title: "1. Information we collect",
          paragraphs: ["Depending on how you use the platform, data may include:"],
          items: [
            "Account information: email, display name, and profile picture.",
            "Optional profile information: birth date, gender, phone number, current address, and biography.",
            "Tournament and team information: organizer roles, registrations, rosters, schedules, and results.",
            "Operational and security information related to sessions and account activity.",
          ],
        },
        {
          title: "2. Why we process information",
          paragraphs: [
            "Information is used to create and authenticate accounts, display profiles, operate registrations and tournaments, deliver relevant notifications, support users, moderate content, and protect the platform.",
          ],
        },
        {
          title: "3. Visibility and sharing",
          paragraphs: [
            "Your display name, profile picture, and information you intentionally place in public content may be visible to others. Remaining data is accessed only as needed for functionality, administration, or legal requirements.",
          ],
        },
        {
          title: "4. Retention",
          paragraphs: [
            "Information is retained while your account is active or as needed to provide services, resolve disputes, maintain security, and meet applicable obligations. Data may be deleted or anonymized when no longer needed.",
          ],
        },
        {
          title: "5. Your choices and rights",
          paragraphs: [
            "You can review and edit supported profile fields on the Personal profile page. For access, correction, restriction, or deletion requests beyond self-service controls, contact the ArenaVerse operator through its official support channel.",
          ],
        },
      ],
    },
  },
};

const documentIcons = {
  terms: FileTextIcon,
  privacy: ShieldCheckIcon,
  "personal-data": FingerprintIcon,
};

export default function LegalDocumentPage({ kind }: { kind: LegalDocumentKind }) {
  const { locale, t } = useLocale();
  const document = documents[locale][kind];
  const Icon = documentIcons[kind];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Link
        href="/"
        className="text-sm font-medium text-ink-muted transition hover:text-brand"
      >
        ← {t("nav.home")}
      </Link>
      <article className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface-card shadow-[var(--shadow-elevated)]">
        <header className="border-b border-line bg-surface-sub/55 px-6 py-8 sm:px-10">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
              <Icon size={26} weight="duotone" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                {document.eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {document.title}
              </h1>
              <p className="mt-3 text-xs text-ink-faint">
                {document.updatedLabel}: {document.updatedAt}
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-7 text-ink-muted sm:text-base">
            {document.introduction}
          </p>
        </header>

        <div className="space-y-9 px-6 py-8 sm:px-10 sm:py-10">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-ink-muted">
                  {paragraph}
                </p>
              ))}
              {section.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-ink-muted marker:text-brand">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
