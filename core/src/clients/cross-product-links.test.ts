import { getCrossLinks, getCrossPromoBanner } from './cross-product-links';

describe('cross-product-links — FIN Tax → DoctorCar', () => {
  const fintaxProduct = 'fintax';

  it('should include DoctorCar link when keywords contain "bảo dưỡng"', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['bảo dưỡng'] });
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(doctorcarLink).toBeDefined();
    expect(doctorcarLink!.label).toBe('Lịch bảo dưỡng thông minh');
    expect(doctorcarLink!.icon).toBe('🚗');
    expect(doctorcarLink!.url).toContain('doctorcar.winlux.com/lich-bao-duong');
    expect(doctorcarLink!.url).toContain('utm_source=fintax');
  });

  it('should include DoctorCar link when keywords contain "sửa xe"', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['sửa xe'] });
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(doctorcarLink).toBeDefined();
    expect(doctorcarLink!.label).toBe('Lịch bảo dưỡng thông minh');
  });

  it('should include DoctorCar link when keywords contain "xăng dầu"', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['xăng dầu'] });
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(doctorcarLink).toBeDefined();
  });

  it('should include DoctorCar link when keywords contain "bảo hiểm xe"', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['bảo hiểm xe'] });
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(doctorcarLink).toBeDefined();
  });

  it('should NOT include DoctorCar link when keywords are unrelated', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['thuốc', 'vitamin'] });
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(doctorcarLink).toBeUndefined();
  });

  it('should NOT include DoctorCar link when no keywords provided', () => {
    const links = getCrossLinks(fintaxProduct, {});
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(doctorcarLink).toBeUndefined();
  });

  it('should still include SmartBuy link alongside DoctorCar link', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['bảo dưỡng'] });
    const smartbuyLink = links.find(l => l.product === 'smartbuy');
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(smartbuyLink).toBeDefined();
    expect(doctorcarLink).toBeDefined();
    expect(links.length).toBe(2);
  });

  it('should include correct UTM parameters in DoctorCar link URL', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['sửa xe'] });
    const doctorcarLink = links.find(l => l.product === 'doctorcar');

    expect(doctorcarLink!.url).toBe(
      'https://doctorcar.winlux.com/lich-bao-duong?utm_medium=cross_promo&utm_source=fintax'
    );
  });

  it('should trigger DoctorCar link with multiple matching keywords', () => {
    const links = getCrossLinks(fintaxProduct, { keywords: ['bảo dưỡng', 'xăng dầu', 'sửa xe'] });
    const doctorcarLinks = links.filter(l => l.product === 'doctorcar');

    // Should only add one DoctorCar link even with multiple matching keywords
    expect(doctorcarLinks.length).toBe(1);
  });
});
