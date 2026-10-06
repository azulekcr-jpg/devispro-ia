from playwright.sync_api import sync_playwright
U='http://localhost:8765/devispro-ai-v1.html'
errs=[];res=[]
def chk(n,c):res.append(('OK ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':800});pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/*',lambda r:r.continue_() if 'localhost' in r.request.url else r.abort())
    pg.goto(U);
    chk('accueil = Mes devis, vide',pg.locator('#ql').inner_text().startswith('Aucun devis'))
    pg.click('nav [data-go=clients]');pg.click('nav [data-go=ent]')
    vals={'n':'Plomberie Martin','a':'12 rue des Lilas, 64100 Bayonne','t':'06 12 34 56 78','m':'contact@martin.fr','s':'812 345 678 00019'}
    for k,v in vals.items():pg.fill(f'[data-p={k}]',v)
    chk('message non enregistré',pg.inner_text('#pmsg')=='Modifications non enregistrées.')
    pg.click('#psave')
    chk('message de confirmation','Informations enregistrées' in pg.inner_text('#pmsg'))
    chk('toast visible',pg.is_visible('#toast'))
    st=pg.evaluate("JSON.parse(localStorage.getItem('dpa2')).prof")
    chk('localStorage contient les 5 champs',st==vals)
    pg.reload()
    pg.click('nav [data-go=ent]')
    chk('champs conservés après actualisation',all(pg.input_value(f'[data-p={k}]')==v for k,v in vals.items()))
    # modifs non enregistrées ne fuitent pas
    pg.fill('[data-p=n]','BROUILLON')
    pg.click('nav [data-go=new]')
    chk('formulaire prérempli (nom, SIRET)',pg.input_value('#co')=='Plomberie Martin' and pg.input_value('#si')=='812 345 678 00019')
    pg.fill('#cl','Mme Lambert');pg.fill('#txt',"Remplacement du chauffe-eau 200 L à 480 €\n3 h main d'œuvre à 55 €")
    pg.click('#gen')
    g=lambda k:pg.input_value(f'#paper [data-f={k}]')
    chk('devis: nom',g('co')=='Plomberie Martin');chk('devis: adresse',g('adr')==vals['a']);chk('devis: tél',g('tel')==vals['t']);chk('devis: email',g('mail')==vals['m']);chk('devis: SIRET',g('si')==vals['s'])
    chk('devis: numéro DEV-2026-001',g('num').endswith('-001'))
    chk('total TTC = (480+165)*1.1 = 709,50',('709,50' in pg.inner_text('#tot').replace('\u202f',' ').replace('\xa0',' ')))
    # reload: devis conservé dans la liste
    pg.reload();chk('devis conservé après actualisation','Mme Lambert' in pg.inner_text('#ql'))
    # modifier le profil puis nouveau devis => nouvelles infos, ancien devis inchangé
    pg.click('nav [data-go=ent]');pg.fill('[data-p=t]','07 00 00 00 00');pg.click('#psave')
    pg.click('nav [data-go=new]');pg.click('[data-ex=elec]')
    chk('exemple: nom du profil conservé (pas écrasé)',pg.input_value('#co')=='Plomberie Martin')
    pg.click('#gen');chk('2e devis: nouveau téléphone',g('tel')=='07 00 00 00 00');chk('2e devis: -002',g('num').endswith('-002'))
    pg.click('#back');pg.fill('#qs','lambert')
    pg.click('#ql [data-act=open]');chk('ancien devis: ancien téléphone',g('tel')==vals['t'])
    # édition ligne, ajout ligne, suppression ligne
    pg.fill('#lines [data-k=p] >> nth=0','500');chk('édition ligne recalcule (731,50)','731,50' in pg.inner_text('#tot').replace('\u202f',' ').replace('\xa0',' '))
    pg.click('#add');chk('ajout ligne',pg.locator('#lines .ln').count()==3)
    pg.click('#lines [data-del="2"]');chk('suppression ligne',pg.locator('#lines .ln').count()==2)
    # suppression devis 2 taps
    pg.click('[data-act=del]');chk('1er tap: confirmation demandée',pg.inner_text('[data-act=del]')=='Confirmer ?')
    pg.click('[data-act=del]');chk('devis supprimé, retour liste',pg.is_visible('#v-devis'))
    # vider le profil
    pg.click('nav [data-go=ent]')
    for k in vals:pg.fill(f'[data-p={k}]','')
    pg.click('#psave');pg.click('nav [data-go=new]');chk('profil vide: formulaire vide',pg.input_value('#co')=='' and pg.input_value('#si')=='')
    # clients
    pg.click('nav [data-go=clients]');pg.fill('#cn','Mme Lambert');pg.fill('#ct','06 99');pg.click('#csave')
    chk('client ajouté','Mme Lambert' in pg.inner_text('#cll'))
    pg.click('nav [data-go=new]');pg.fill('#cl','mme lambert');pg.fill('#txt','2 prises à 35 €');pg.click('#gen')
    chk('client lié: tél repris',pg.input_value('#paper [data-c=tel]')=='06 99')
    chk('mobile: pas de défilement horizontal',pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
    b.close()
print('\n'.join(res));print('ERREURS JS:',errs or 'aucune')
